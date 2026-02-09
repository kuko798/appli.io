/* eslint-disable no-undef */
import Groq from '../background/groq.js';

export const gmailService = {
    async startSync(range, onStatusChange) {
        try {
            await this.syncEmails(range, onStatusChange);
            return "✅ Sync complete";
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
            return "❌ Error: " + error.message;
        }
    },

    async syncEmails(range = "1m", onStatusChange) {
        const token = await this.getToken();
        if (!token) throw new Error("Could not get auth token");

        const afterDate = this.calculateAfterDate(range);

        if (onStatusChange) onStatusChange(`Searching emails since ${afterDate}...`);

        const query = `subject:(application OR interview OR offer OR rejection) after:${afterDate}`;
        let nextPageToken = null;
        let pageCount = 0;

        do {
            pageCount++;
            let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`;
            if (nextPageToken) url += `&pageToken=${nextPageToken}`;

            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();

            if (data.messages && data.messages.length > 0) {
                for (const msg of data.messages) {
                    await this.processMessage(msg.id, token);
                }
            }
            nextPageToken = data.nextPageToken;
        } while (nextPageToken);
    },

    async processMessage(messageId, token) {
        try {
            const email = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            ).then(r => r.json());

            const headers = email.payload.headers;
            const subject = this.getHeader(headers, "Subject");
            const from = this.getHeader(headers, "From");
            const snippet = email.snippet || "";
            const fullBody = this.extractBody(email.payload) || snippet;
            const date = this.getHeader(headers, "Date");

            if (this.isPromotional(subject, fullBody, from)) return;

            const apiKey = await this.getGroqKey();
            if (!apiKey) throw new Error("Missing Groq API Key");

            const analysis = await Groq.analyzeEmail(apiKey, subject, fullBody);
            if (!analysis || !analysis.role) return;

            await this.saveJob({
                id: messageId,
                company: analysis.company || this.extractJobDetails(from, subject).company,
                title: analysis.role,
                subject,
                status: analysis.status || "Applied",
                date,
                lastUpdated: new Date().toISOString()
            });

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

    async getToken() {
        if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getAuthToken) {
            return new Promise((resolve) => {
                chrome.identity.getAuthToken({ interactive: true }, (token) => resolve(token));
            });
        }
        // Web demo will override this in the mock
        return window._mockToken;
    },

    async getGroqKey() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['groqApiKey'], (items) => resolve(items.groqApiKey));
        });
    },

    async saveJob(job) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "SAVE_JOB_INTERNAL", job }, resolve);
        });
    },

    getHeader(headers, name) {
        return headers.find(h => h.name === name)?.value || "";
    },

    isPromotional(subject, body, from) {
        const s = subject.toLowerCase();
        const f = from.toLowerCase();
        const badSubjects = ["newsletter", "job recommendations", "digest", "webinar", "matches for you"];
        const badSenders = ["noreply@glassdoor.com", "notifications@linkedin.com"];
        return badSubjects.some(w => s.includes(w)) || badSenders.some(w => f.includes(w));
    },

    extractJobDetails(from, subject) {
        let company = "Unknown";
        const nameMatch = from.match(/^"?([^"<]+)"?/);
        if (nameMatch) company = nameMatch[1].trim();
        return { company: company.replace(/,?\s?(Inc|LLC|Ltd|Corp)\.?$/i, "").trim() };
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
            return new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
        } catch (e) { return ""; }
    }
};
