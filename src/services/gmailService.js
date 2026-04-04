/* eslint-disable no-undef */
/** Gmail sync + classification for the web dashboard (and optional MV3 notifications when `chrome.notifications` exists). */
import { scheduleRemoteJobsPush } from '../dashboard/jobsSync.js';
import LocalLLM from '../background/localLLM.js';
import Classifier from '../background/classifier.js';

export const gmailService = {
    MAX_PARALLEL_EMAILS: 1,
    PROCESSED_CACHE_KEY: "processedEmailCache",
    PROCESSED_CACHE_MAX: 6000,
    PROCESSED_CACHE_TTL_DAYS: 120,
    _saveLock: false,
    _saveQueue: [],
    STATUS_PRIORITY: {
        Applied: 1,
        Assessment: 2,
        Interview: 3,
        Rejected: 4,
        Offer: 5
    },

    async startSync(range, onStatusChange) {
        try {
            await this.syncEmails(range, onStatusChange);
            return "Sync complete";
        } catch (error) {
            console.error("Sync error:", error);
            if (typeof chrome !== 'undefined' && chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon.png',
                    title: 'Sync Failed',
                    message: error.message
                });
            }
            return "Error: " + error.message;
        }
    },

    async clearProcessedEmailCache() {
        await new Promise((resolve) => {
            chrome.storage.local.set({ [this.PROCESSED_CACHE_KEY]: {} }, resolve);
        });
        console.log("[Sync] Cleared processed-email cache (full re-run)");
    },

    async syncEmails(range = "1m", onStatusChange) {
        const tokenHolder = { token: await this.getToken({ interactive: true }) };
        if (!tokenHolder.token) throw new Error("Could not get auth token");

        if (onStatusChange) onStatusChange("Clearing sync cache…");
        await this.clearProcessedEmailCache();
        LocalLLM.clearCache();

        const afterDate = this.calculateAfterDate(range);
        if (onStatusChange) onStatusChange(`Searching emails since ${afterDate}...`);

        const query = `(subject:(application OR interview OR offer OR rejection OR "thank you for applying" OR "thanks for applying" OR "your application" OR "application status" OR "thank you for your interest" OR "update on" OR "Google Application" OR coderpad OR hackerrank OR "coding challenge") OR ("move forward" OR "not moving forward" OR "next steps" OR "phone screen" OR "we regret" OR "unable to offer" OR "other candidates" OR hackerrank OR coderpad)) after:${afterDate}`;
        let nextPageToken = null;

        do {
            let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`;
            if (nextPageToken) url += `&pageToken=${nextPageToken}`;

            const res = await this.authorizedGmailFetch(url, tokenHolder);
            if (!res.ok) {
                const snippet = await res.text();
                throw new Error(`Gmail list failed (${res.status}): ${snippet.slice(0, 180)}`);
            }
            const data = await res.json();

            if (data.messages && data.messages.length > 0) {
                console.log(`[Sync] Found ${data.messages.length} emails to process`);
                await this.processMessagesFast(data.messages, tokenHolder);
            } else {
                console.log("[Sync] No emails found for query:", query);
            }
            nextPageToken = data.nextPageToken;
        } while (nextPageToken);
    },

    async processMessagesFast(messages, tokenHolder) {
        const concurrency = Math.max(1, this.MAX_PARALLEL_EMAILS || 1);
        for (let i = 0; i < messages.length; i += concurrency) {
            const batch = messages.slice(i, i + concurrency);
            await Promise.allSettled(batch.map((msg) => this.processMessage(msg.id, tokenHolder)));
        }
    },

    async processMessage(messageId, tokenHolder) {
        try {
            if (await this.wasEmailProcessed(messageId)) {
                console.log("[Sync] Skipped (already processed):", messageId);
                return;
            }

            const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
            const msgRes = await this.authorizedGmailFetch(msgUrl, tokenHolder);
            if (!msgRes.ok) {
                console.warn("[Sync] Could not fetch message:", messageId, msgRes.status);
                return;
            }
            const email = await msgRes.json();

            const headers = email.payload.headers;
            const subject = this.getHeader(headers, "Subject");
            const from = this.getHeader(headers, "From");
            const snippet = email.snippet || "";
            const fullBody = this.extractBody(email.payload) || snippet;
            const date = this.getHeader(headers, "Date");

            console.log("[Sync] Processing email:", { subject, from, date });

            if (this.isPromotional(subject, fullBody, from)) {
                console.log("[Sync] Skipped (promotional):", subject);
                await this.markEmailProcessed(messageId, "promotional");
                return;
            }

            if (!this.shouldAnalyzeEmail(subject, fullBody, from)) {
                console.log("[Sync] Skipped (not job-related enough):", subject);
                await this.markEmailProcessed(messageId, "not-job-related");
                return;
            }

            let analysis = null;
            try {
                analysis = await LocalLLM.analyzeEmail(subject, fullBody, from);
                console.log("[Sync] LLM analysis:", { subject, analysis });
                if (analysis?.status && analysis?.reason) {
                    console.log(`[Sync] Status reasoning (${analysis.status}): ${analysis.reason}`);
                }
                if (analysis && analysis.status === null) {
                    console.log("[Sync] Skipped (non-application content):", subject, analysis.reason || "");
                    await this.markEmailProcessed(messageId, "non-application");
                    return;
                }
            } catch (llmErr) {
                console.warn("[Sync] LLM failed (strict mode — no rule fallback):", llmErr?.message || llmErr);
                await this.markEmailProcessed(messageId, "llm-failed");
                return;
            }

            const role = analysis?.role || null;
            const company = analysis?.company || null;
            if (!role) {
                const updated = await this.updateExistingStatusWithoutRole({
                    messageId,
                    subject,
                    company,
                    status: analysis?.status || null,
                    date
                });
                if (updated) {
                    console.log("[Sync] Updated existing job status without role:", { subject, company, status: analysis?.status });
                    await this.markEmailProcessed(messageId, "status-updated");
                    return;
                }
                console.log("[Sync] Skipped (no role found):", subject);
                await this.markEmailProcessed(messageId, "no-role");
                return;
            }

            await this.saveJob({
                id: messageId,
                company,
                title: role,
                subject,
                status: analysis?.status || "Applied",
                date,
                lastUpdated: new Date().toISOString(),
                aiConfidence: analysis?.confidence ?? null,
                aiSignals: analysis?.signals || [],
                aiNextAction: analysis?.nextAction || null,
                aiSummary: analysis?.summary || null,
                aiReason: analysis?.reason || null
            });
            await this.markEmailProcessed(messageId, "saved");
        } catch (err) {
            console.error("Error processing msg:", messageId, err);
        }
    },

    calculateAfterDate(range) {
        const dateObj = new Date();
        if (range === "1m") dateObj.setMonth(dateObj.getMonth() - 1);
        if (range === "3m") dateObj.setMonth(dateObj.getMonth() - 3);
        if (range === "6m") dateObj.setMonth(dateObj.getMonth() - 6);
        if (range === "1y") dateObj.setFullYear(dateObj.getFullYear() - 1);

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        return `${year}/${month}/${day}`;
    },

    /** Drop a rejected access token so the next getAuthToken can mint a fresh one. */
    async invalidateBearerToken(token) {
        if (!token) return;
        try {
            if (typeof chrome !== "undefined" && chrome.identity?.removeCachedAuthToken) {
                await new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));
            }
        } catch {
            /* ignore */
        }
        if (typeof localStorage !== "undefined") {
            if (localStorage.getItem("appli_token") === token) {
                localStorage.removeItem("appli_token");
                localStorage.removeItem("appli_token_expires_at");
            }
        }
        if (typeof window !== "undefined") window._mockToken = null;
    },

    /**
     * Gmail fetch with one automatic retry after 401 (expired access token).
     * Mutates tokenHolder.token when refreshed.
     */
    async authorizedGmailFetch(url, tokenHolder) {
        const headers = { Authorization: `Bearer ${tokenHolder.token}` };
        let res = await fetch(url, { headers });
        if (res.status !== 401) return res;
        await this.invalidateBearerToken(tokenHolder.token);
        const fresh = await this.getToken({ interactive: true });
        if (!fresh) return res;
        tokenHolder.token = fresh;
        return fetch(url, { headers: { Authorization: `Bearer ${fresh}` } });
    },

    async getToken(options = {}) {
        const interactive = options.interactive !== false;
        if (typeof chrome !== "undefined" && chrome.identity?.getAuthToken) {
            return new Promise((resolve) => {
                chrome.identity.getAuthToken({ interactive }, (token) => resolve(token || null));
            });
        }
        return window._mockToken || null;
    },

    async saveJob(job) {
        return this.saveJobDirect(job);
    },

    async saveJobDirect(newJob) {
        const jobs = await new Promise((resolve) => {
            chrome.storage.local.get("jobs", (result) => resolve(result.jobs || []));
        });

        const idIndex = jobs.findIndex((j) => j.id === newJob.id);
        if (idIndex !== -1) {
            const oldJob = jobs[idIndex];
            if (this.getStatusPriority(newJob.status) > this.getStatusPriority(oldJob.status)) {
                jobs[idIndex] = { ...oldJob, ...newJob };
                await new Promise((resolve) => chrome.storage.local.set({ jobs }, resolve));
                scheduleRemoteJobsPush();
            }
            return;
        }

        const similarIndex = jobs.findIndex((j) => {
            return this.isSameCompany(j.company, newJob.company) &&
                Math.abs(new Date(j.date) - new Date(newJob.date)) < 1000 * 60 * 60 * 24 * 120;
        });

        if (similarIndex !== -1) {
            const oldJob = jobs[similarIndex];
            if (this.getStatusPriority(newJob.status) > this.getStatusPriority(oldJob.status)) {
                jobs[similarIndex] = { ...oldJob, status: newJob.status, lastUpdated: newJob.lastUpdated };
                await new Promise((resolve) => chrome.storage.local.set({ jobs }, resolve));
                scheduleRemoteJobsPush();
            }
            return;
        }

        jobs.push(newJob);
        await new Promise((resolve) => chrome.storage.local.set({ jobs }, resolve));
        scheduleRemoteJobsPush();
    },

    async updateExistingStatusWithoutRole({ messageId, subject, company, status, date }) {
        if (!status) return false;
        const jobs = await new Promise((resolve) => {
            chrome.storage.local.get("jobs", (result) => resolve(result.jobs || []));
        });
        if (!jobs.length) return false;

        const normalizedSubject = this.normalizeText(subject);
        const targetDate = new Date(date);
        let bestIndex = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            const dateGapDays = Math.abs(new Date(job.date) - targetDate) / (1000 * 60 * 60 * 24);
            if (dateGapDays > 180) continue;

            let score = 0;
            if (this.isSameCompany(job.company, company)) score += 5;

            const jobSubject = this.normalizeText(job.subject || "");
            if (jobSubject && normalizedSubject) {
                if (jobSubject === normalizedSubject) score += 6;
                else if (jobSubject.includes(normalizedSubject) || normalizedSubject.includes(jobSubject)) score += 4;
            }

            if (dateGapDays <= 30) score += 3;
            else if (dateGapDays <= 90) score += 1;

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        if (bestIndex === -1 || bestScore < 4) return false;

        const oldJob = jobs[bestIndex];
        if (this.getStatusPriority(status) <= this.getStatusPriority(oldJob.status)) return false;

        jobs[bestIndex] = {
            ...oldJob,
            id: oldJob.id || messageId,
            status,
            lastUpdated: new Date().toISOString()
        };
        await new Promise((resolve) => chrome.storage.local.set({ jobs }, resolve));
        scheduleRemoteJobsPush();
        return true;
    },

    getStatusPriority(status) {
        return this.STATUS_PRIORITY[status] || 0;
    },

    normalizeText(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    },

    isSameCompany(a, b) {
        const left = this.normalizeText(a).replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, "").trim();
        const right = this.normalizeText(b).replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, "").trim();
        if (!left || !right) return false;
        return left === right || left.includes(right) || right.includes(left);
    },

    getHeader(headers, name) {
        return headers.find((h) => h.name === name)?.value || "";
    },

    isPromotional(subject, body, from) {
        const s = subject.toLowerCase();
        const b = (body || "").toLowerCase();
        const f = from.toLowerCase();
        const badSubjects = [
            "newsletter",
            "job recommendations",
            "digest",
            "webinar",
            "matches for you",
            "ask a recruiter",
            "office hours",
            "listen now",
            "new jobs for you",
            "jobs you may like",
            "recommended jobs",
            "jobs near you",
            "weekly jobs",
            "job alert",
            "career digest"
        ];
        const badBodyPhrases = [
            "ask a recruiter",
            "tips from",
            "interview tips",
            "ace the interview",
            "ace interviews",
            "think on your feet",
            "listen now",
            "podcast",
            "communication expert",
            "watch now",
            "register now",
            "jobs based on your profile",
            "similar jobs",
            "unsubscribe from job alerts"
        ];
        const badSenders = [
            "noreply@glassdoor.com",
            "notifications@linkedin.com",
            "jobalerts@",
            "alerts@indeed.com",
            "newsletter@",
            "marketing@indeed.com",
            "jobs-noreply@linkedin.com"
        ];
        return (
            badSubjects.some((w) => s.includes(w)) ||
            badBodyPhrases.some((w) => b.includes(w)) ||
            badSenders.some((w) => f.includes(w))
        );
    },

    isLikelyJobBoardBlast(subject, body, from) {
        const s = (subject || "").toLowerCase();
        const b = (body || "").toLowerCase().slice(0, 800);
        const f = (from || "").toLowerCase();
        if (/\b\d+\+?\s*(new )?jobs\b/i.test(s) && /job|career|role/i.test(s)) return true;
        if (/\bjobs (for|matching|recommended|picked|near) you\b/i.test(s)) return true;
        if (/\b(weekly|daily) (job |)(digest|roundup)\b/i.test(s)) return true;
        if (b.includes("view all jobs") && b.includes("apply")) return true;
        if (/@(indeed|ziprecruiter|monster)\./i.test(f) && /job alert|new jobs/i.test(s + b)) return true;
        return false;
    },

    shouldAnalyzeEmail(subject, body, from) {
        const text = `${subject || ""}\n${body || ""}\n${from || ""}`;
        const lower = text.toLowerCase();

        if (this.isLikelyJobBoardBlast(subject, body, from)) return false;

        const strongPatterns = [
            /thank you for (your )?applying/i,
            /thank you for your application/i,
            /application (has been )?received/i,
            /received your application/i,
            /we (have )?received your application/i,
            /regret to (inform|advise)/i,
            /not (be )?moving forward/i,
            /not selected/i,
            /phone screen/i,
            /schedule (a |an )?(call|interview|time)/i,
            /invite you to/i,
            /\bjob offer\b/i,
            /offer letter/i,
            /pleased to (extend|offer)/i,
            /would like to (extend|offer)/i,
            /other candidate|other candidates|another candidate/i,
            /status of your application/i,
            /update on your application/i,
            /your application for\b/i,
            /your candidacy/i,
            /next steps.{0,40}(interview|call|schedule)/i,
            /thanks?\s+for\s+applying/i,
            /\bcoderpad\b|\bhackerrank\b|\bcoding challenge\b|\bcode\s*signal\b/i,
            /next steps with\b/i,
            /won'?t be able to invite you to the next stage/i,
            /thank you for your interest/i,
            /application status/i,
            /won'?t be moving forward/i,
            /move forward with (other|another) candidate/i,
            /unable to offer you (this )?position/i,
            /not able to move forward with your candidacy/i,
            /not been selected for further consideration/i,
            /regret to inform you that it has not been selected/i,
            /update on your application/i,
            /decided to move forward with other candidates/i,
            /proceed with other candidates/i,
            /thank you for applying to our\b/i
        ];
        if (strongPatterns.some((re) => re.test(text))) return true;

        const softHits = [
            "hiring manager",
            "talent acquisition",
            "recruiting team",
            "your interview",
            "application for the",
            "role you applied",
            "position you applied"
        ].filter((phrase) => lower.includes(phrase)).length;

        return softHits >= 2;
    },

    async wasEmailProcessed(messageId) {
        const cache = await this.getProcessedEmailCache();
        return Boolean(cache[messageId]);
    },

    async markEmailProcessed(messageId, result) {
        const cache = await this.getProcessedEmailCache();
        cache[messageId] = {
            ts: Date.now(),
            result: result || "processed"
        };
        const pruned = this.pruneProcessedCache(cache);
        await new Promise((resolve) => chrome.storage.local.set({ [this.PROCESSED_CACHE_KEY]: pruned }, resolve));
    },

    async getProcessedEmailCache() {
        const cache = await new Promise((resolve) => {
            chrome.storage.local.get(this.PROCESSED_CACHE_KEY, (result) => {
                resolve(result[this.PROCESSED_CACHE_KEY] || {});
            });
        });
        return this.pruneProcessedCache(cache);
    },

    pruneProcessedCache(cache) {
        const input = cache && typeof cache === "object" ? cache : {};
        const ttlMs = this.PROCESSED_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const entries = Object.entries(input)
            .filter(([, value]) => value && typeof value.ts === "number" && (now - value.ts) <= ttlMs)
            .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
            .slice(0, this.PROCESSED_CACHE_MAX);

        return Object.fromEntries(entries);
    },

    extractBody(payload) {
        let encoded = "";
        const findText = (p) => {
            if (p.body && p.body.data && p.mimeType === "text/plain") return p.body.data;
            if (p.parts) {
                for (const part of p.parts) {
                    const found = findText(part);
                    if (found) return found;
                }
            }
            return "";
        };
        encoded = payload.body && payload.body.data ? payload.body.data : findText(payload);
        if (!encoded) return "";
        try {
            return new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
        } catch {
            return "";
        }
    }
};
