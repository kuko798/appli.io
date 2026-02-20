const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Model tiers — pick per task
const MODEL_HAIKU = "claude-haiku-4-5-20251001";  // Fast: email classification, live chat
const MODEL_SONNET = "claude-sonnet-4-6";           // Smart: document analysis, intelligence reports

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000; // ms — doubles each retry + jitter
const REQUEST_TIMEOUT = 60000; // 60 seconds (generous for large doc analysis)
const CACHE_MAX_SIZE = 500;
const MIN_REQUEST_INTERVAL = 250; // ~4 req/sec max during bulk email sync

const VALID_STATUSES = ["Applied", "Interview", "Offer", "Rejected", null];

const Claude = {
    // ─── Email analysis queue & cache ───────────────────────────────────────
    _queue: [],
    _processing: false,
    _cache: new Map(),
    _lastRequestTime: 0,

    // ─── Public: Email classification ───────────────────────────────────────

    /**
     * Classify a job application email.
     * Returns { status, role, company }.
     * Results are cached by subject+body fingerprint; queue enforces rate limit.
     */
    async analyzeEmail(apiKey, subject, body) {
        if (!apiKey) throw new Error("Claude API key is missing");

        const cacheKey = this._makeCacheKey(subject, body);
        if (this._cache.has(cacheKey)) {
            console.log("📦 Claude: returning cached email result");
            return this._cache.get(cacheKey);
        }

        return this._enqueue(() => this._analyzeWithRetry(apiKey, subject, body, cacheKey));
    },

    // ─── Public: General-purpose generation ─────────────────────────────────

    /**
     * Generate free-form text (for DeepScan, InterviewSimulator, etc.).
     * No queue needed — these are single user-initiated requests.
     *
     * @param {string} apiKey
     * @param {{ system?: string, messages: Array<{role,content}>, temperature?: number, maxTokens?: number, model?: string }} opts
     * @returns {Promise<string>}
     */
    async generate(apiKey, { system = null, messages, temperature = 0.5, maxTokens = 2000, model = MODEL_SONNET }) {
        if (!apiKey) throw new Error("Claude API key is missing");
        return this._withRetry(() =>
            this._rawRequest(apiKey, { system, messages, temperature, maxTokens, model })
        );
    },

    /**
     * Generate and parse a JSON response (for ResumeDiagnostic, etc.).
     * Falls back to regex extraction if the model wraps in markdown.
     *
     * @param {string} apiKey
     * @param {{ system?: string, messages: Array<{role,content}>, temperature?: number, maxTokens?: number, model?: string }} opts
     * @returns {Promise<object>}
     */
    async generateJSON(apiKey, { system = null, messages, temperature = 0.25, maxTokens = 6000, model = MODEL_SONNET }) {
        if (!apiKey) throw new Error("Claude API key is missing");

        const text = await this._withRetry(() =>
            this._rawRequest(apiKey, { system, messages, temperature, maxTokens, model })
        );

        // Strip markdown code fences if present
        const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

        try {
            return JSON.parse(stripped);
        } catch {
            // Last resort: find the outermost JSON object in the text
            const match = stripped.match(/\{[\s\S]*\}/);
            if (match) {
                try { return JSON.parse(match[0]); } catch { }
            }
            throw new Error(`Claude returned unparseable JSON. Preview: ${stripped.substring(0, 120)}`);
        }
    },

    // ─── Public: Key management ──────────────────────────────────────────────

    /**
     * Validate an API key with a minimal request.
     */
    async validateKey(apiKey) {
        if (!apiKey) return false;
        try {
            const response = await fetch(CLAUDE_API_URL, {
                method: "POST",
                headers: this._headers(apiKey),
                body: JSON.stringify({
                    model: MODEL_HAIKU,
                    max_tokens: 1,
                    messages: [{ role: "user", content: "hi" }]
                })
            });
            // 529 = API overloaded but key is valid
            return response.ok || response.status === 529;
        } catch {
            return false;
        }
    },

    /**
     * Clear the email analysis cache (e.g. before a forced re-sync).
     */
    clearCache() {
        this._cache.clear();
    },

    // ─── Private: Retry helpers ──────────────────────────────────────────────

    /**
     * Shared retry wrapper. Retries on 429, 5xx, timeout; fails fast on 4xx auth errors.
     */
    async _withRetry(fn) {
        let lastError;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 300;
                console.log(`⏳ Claude: retry ${attempt}/${MAX_RETRIES - 1} in ${Math.round(delay)}ms`);
                await this._sleep(delay);
            }
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                // Auth / bad request — never retry, surface immediately
                if (err.status === 400 || err.status === 401 || err.status === 403) throw err;
                // Transient — retry
                if (err.status === 429 || err.status === 408 || (err.status >= 500 && err.status < 600)) continue;
                // Any other error — don't retry
                throw err;
            }
        }
        throw lastError;
    },

    // ─── Private: HTTP ───────────────────────────────────────────────────────

    _headers(apiKey) {
        return {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        };
    },

    async _rawRequest(apiKey, { system, messages, temperature, maxTokens, model }) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            const body = { model, max_tokens: maxTokens, messages };
            if (system) body.system = system;
            if (temperature !== undefined) body.temperature = temperature;

            const response = await fetch(CLAUDE_API_URL, {
                method: "POST",
                headers: this._headers(apiKey),
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const err = new Error(errorData.error?.message || `Claude API error ${response.status}`);
                err.status = response.status;
                throw err;
            }

            const data = await response.json();
            return (data.content?.[0]?.text || "").trim();

        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === "AbortError") {
                const timeout = new Error("Claude request timed out");
                timeout.status = 408;
                throw timeout;
            }
            throw err;
        }
    },

    // ─── Private: Email queue & analysis ────────────────────────────────────

    _makeCacheKey(subject, body) {
        return (subject + "|" + body.substring(0, 300)).toLowerCase().trim();
    },

    _enqueue(fn) {
        return new Promise((resolve, reject) => {
            this._queue.push({ fn, resolve, reject });
            if (!this._processing) this._processQueue();
        });
    },

    async _processQueue() {
        if (this._processing) return;
        this._processing = true;

        while (this._queue.length > 0) {
            const elapsed = Date.now() - this._lastRequestTime;
            if (elapsed < MIN_REQUEST_INTERVAL) {
                await this._sleep(MIN_REQUEST_INTERVAL - elapsed);
            }

            const { fn, resolve, reject } = this._queue.shift();
            try {
                resolve(await fn());
            } catch (err) {
                reject(err);
            }
            this._lastRequestTime = Date.now();
        }

        this._processing = false;
    },

    async _analyzeWithRetry(apiKey, subject, body, cacheKey) {
        const messages = [{ role: "user", content: this._buildEmailPrompt(subject, body) }];

        const text = await this._withRetry(() =>
            this._rawRequest(apiKey, {
                model: MODEL_HAIKU,
                messages,
                temperature: 0.1,
                maxTokens: 150
            })
        );

        // Strip markdown code fences
        const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            throw new Error(`Claude returned non-JSON: ${text.substring(0, 100)}`);
        }

        if (!VALID_STATUSES.includes(parsed.status)) {
            throw new Error(`Unexpected status value: ${parsed.status}`);
        }

        parsed.role = parsed.role || null;
        parsed.company = parsed.company || null;

        // Cache result (evict oldest if at capacity)
        if (this._cache.size >= CACHE_MAX_SIZE) {
            this._cache.delete(this._cache.keys().next().value);
        }
        this._cache.set(cacheKey, parsed);

        console.log("🤖 Claude email:", parsed);
        return parsed;
    },

    _buildEmailPrompt(subject, body) {
        const truncatedBody = body.length > 4000
            ? body.substring(0, 3800) + "\n...[truncated]"
            : body;

        return `You are a precise job application email classifier. Analyze the email and return ONLY a JSON object — no markdown, no explanation.

TASK: Decide if this email is about a real job application (confirmation, interview invite, offer, or rejection). Generic newsletters, job board alerts, and marketing emails are NOT real job application emails.

STATUS VALUES (choose exactly one):
- "Applied"    → application received / submission confirmed
- "Interview"  → interview invite, scheduling request, phone/video screen
- "Offer"      → job offer extended to the applicant
- "Rejected"   → not moving forward, declined, position filled, pursuing other candidates
- null         → not a job application email

CRITICAL RULES:
- "We offered the position to another candidate" → status = "Rejected", NOT "Offer"
- "We are not moving forward" → status = "Rejected"
- "Thank you for applying, we'll be in touch" → status = "Applied"
- Extract the exact job title (e.g. "Software Engineer") and company name if mentioned
- If the role or company truly cannot be inferred, use null

Email Subject: ${subject}

Email Body:
${truncatedBody}

Respond with ONLY this JSON:
{"status":"Applied"|"Interview"|"Offer"|"Rejected"|null,"role":"string or null","company":"string or null"}`;
    },

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

export default Claude;
