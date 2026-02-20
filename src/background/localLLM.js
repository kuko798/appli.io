/**
 * localLLM.js
 *
 * Connects to a locally running Ollama server (https://ollama.com).
 * Zero API keys. Zero external cloud services. Your machine, your model.
 *
 * Default endpoint : http://localhost:11434
 * Default model    : llama3.2
 *
 * Users can override both in the extension options page.
 */

const OLLAMA_CHAT_PATH = "/api/chat";
const OLLAMA_TAGS_PATH = "/api/tags"; // used for ping / model listing

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 800;
const REQUEST_TIMEOUT = 180000; // 3 min — local inference can be slow on CPU
const CACHE_MAX_SIZE = 500;
const MIN_REQUEST_INTERVAL = 100; // ms between queued email requests

const VALID_STATUSES = ["Applied", "Interview", "Offer", "Rejected", null];

const LocalLLM = {
    // ─── Email analysis queue & result cache ────────────────────────────────
    _queue: [],
    _processing: false,
    _cache: new Map(),
    _lastRequestTime: 0,

    // ─── Settings cache (avoids repeated storage reads) ─────────────────────
    _settings: null,

    // ─── Public: settings ────────────────────────────────────────────────────

    async getSettings() {
        if (this._settings) return this._settings;
        return new Promise((resolve) => {
            chrome.storage.sync.get(
                { ollamaUrl: "http://localhost:11434", ollamaModel: "llama3.2:1b" },
                (items) => {
                    this._settings = items;
                    resolve(items);
                }
            );
        });
    },

    /** Invalidate settings cache (call after the user saves new options). */
    resetSettings() {
        this._settings = null;
    },

    // ─── Public: availability check ─────────────────────────────────────────

    /**
     * Returns true if Ollama is reachable and the chosen model is available.
     * Silently returns false on any error.
     */
    async isAvailable() {
        try {
            const { ollamaUrl, ollamaModel } = await this.getSettings();
            const response = await fetch(`${ollamaUrl}${OLLAMA_TAGS_PATH}`, {
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) return false;
            const data = await response.json();
            // Check if the configured model is pulled
            return (data.models || []).some(
                (m) => m.name === ollamaModel || m.name.startsWith(ollamaModel + ":")
            );
        } catch {
            return false;
        }
    },

    /**
     * List all models available in the local Ollama instance.
     * @returns {Promise<string[]>} model names
     */
    async listModels() {
        try {
            const { ollamaUrl } = await this.getSettings();
            const response = await fetch(`${ollamaUrl}${OLLAMA_TAGS_PATH}`, {
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) return [];
            const data = await response.json();
            return (data.models || []).map((m) => m.name);
        } catch {
            return [];
        }
    },

    // ─── Public: email classification ────────────────────────────────────────

    /**
     * Classify a job application email.
     * Results cached by subject+body fingerprint.
     * Calls are queued to respect MIN_REQUEST_INTERVAL during bulk syncs.
     *
     * @returns {Promise<{status: string|null, role: string|null, company: string|null}>}
     */
    async analyzeEmail(subject, body) {
        const cacheKey = this._makeCacheKey(subject, body);
        if (this._cache.has(cacheKey)) {
            console.log("📦 LocalLLM: cached email result");
            return this._cache.get(cacheKey);
        }
        return this._enqueue(() => this._analyzeEmailWithRetry(subject, body, cacheKey));
    },

    // ─── Public: general generation ─────────────────────────────────────────

    /**
     * Generate free-form text.
     *
     * @param {{ system?: string, messages: Array<{role,content}>, temperature?: number, maxTokens?: number, model?: string }} opts
     * @returns {Promise<string>}
     */
    async generate({ system = null, messages, temperature = 0.5, maxTokens = 2000, model = null }) {
        return this._withRetry(() =>
            this._chatRequest({ system, messages, temperature, maxTokens, model, format: null })
        );
    },

    /**
     * Generate and parse a JSON object.
     * Passes format:"json" to Ollama which guarantees valid JSON output.
     *
     * @param {{ system?: string, messages: Array<{role,content}>, temperature?: number, maxTokens?: number, model?: string }} opts
     * @returns {Promise<object>}
     */
    async generateJSON({ system = null, messages, temperature = 0.25, maxTokens = 4000, model = null }) {
        const text = await this._withRetry(() =>
            this._chatRequest({ system, messages, temperature, maxTokens, model, format: "json" })
        );
        // Strip any accidental markdown fences
        const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        console.log("[LocalLLM] raw_json_text:", stripped.substring(0, 500));
        try {
            return JSON.parse(stripped);
        } catch {
            const match = stripped.match(/\{[\s\S]*\}/);
            if (match) {
                try { return JSON.parse(match[0]); } catch { }
            }
            const err = new Error(`Model returned unparseable JSON. Preview: ${stripped.substring(0, 120)}`);
            err.rawText = stripped;
            throw err;
        }
    },

    /** Clear the email analysis cache. */
    clearCache() {
        this._cache.clear();
    },

    // ─── Private: retry ──────────────────────────────────────────────────────

    async _withRetry(fn) {
        let lastError;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 200;
                console.log(`⏳ LocalLLM: retry ${attempt}/${MAX_RETRIES - 1} in ${Math.round(delay)}ms`);
                await this._sleep(delay);
            }
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                // Don't retry on bad requests
                if (err.status === 400 || err.status === 404) throw err;
                // Retry on timeout, server errors, connection refused
            }
        }
        throw lastError;
    },

    // ─── Private: HTTP ───────────────────────────────────────────────────────

    async _chatRequest({ system, messages, temperature, maxTokens, model, format }) {
        const { ollamaUrl, ollamaModel } = await this.getSettings();
        const activeModel = model || ollamaModel;
        const url = `${ollamaUrl}${OLLAMA_CHAT_PATH}`;

        const body = {
            model: activeModel,
            messages,
            stream: false,
            options: {
                temperature,
                num_predict: maxTokens
            }
        };
        if (system) body.system = system;
        if (format) body.format = format;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const text = await response.text().catch(() => "");
                const err = new Error(text || `Ollama error ${response.status}`);
                err.status = response.status;
                throw err;
            }

            const data = await response.json();
            return (data.message?.content || "").trim();

        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === "AbortError") {
                const e = new Error("Ollama request timed out — model may be loading, try again");
                e.status = 408;
                throw e;
            }
            // Connection refused = Ollama not running
            if (err.message?.includes("fetch") || err.message?.includes("network") || err.message?.includes("Failed to fetch")) {
                const e = new Error("Cannot reach Ollama — is it running? Run: ollama serve");
                e.status = 503;
                throw e;
            }
            throw err;
        }
    },

    // ─── Private: email analysis ─────────────────────────────────────────────

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
            if (elapsed < MIN_REQUEST_INTERVAL) await this._sleep(MIN_REQUEST_INTERVAL - elapsed);
            const { fn, resolve, reject } = this._queue.shift();
            try { resolve(await fn()); } catch (err) { reject(err); }
            this._lastRequestTime = Date.now();
        }
        this._processing = false;
    },

    async _analyzeEmailWithRetry(subject, body, cacheKey) {
        const truncatedBody = body.length > 4000
            ? body.substring(0, 3800) + "\n...[truncated]"
            : body;

        const prompt = `You are a precise job application email classifier. Analyze the email and return ONLY a valid JSON object — no explanation, no markdown.

TASK: Decide if this email is about a real job application. Generic newsletters, job alerts, and promotional emails are NOT job application emails.

STATUS (choose exactly one):
- "Applied"    → application received / confirmed
- "Interview"  → invite to interview, phone screen, or scheduling request
- "Offer"      → job offer extended to this applicant
- "Rejected"   → not moving forward, declined, position filled
- null         → not a job application email

RULES:
- "offered the role to another candidate" → "Rejected", NOT "Offer"
- "not moving forward" → "Rejected"
- Extract exact job title and company name when mentioned; otherwise null

Email Subject: ${subject}
Email Body:
${truncatedBody}

Return ONLY this JSON (no other text):
{"status":"Applied"|"Interview"|"Offer"|"Rejected"|null,"role":"string or null","company":"string or null"}`;

        const text = await this._withRetry(() =>
            this._chatRequest({
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                maxTokens: 120,
                format: "json"
            })
        );

        const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        let parsed;
        try {
            parsed = JSON.parse(stripped);
        } catch {
            throw new Error(`Model returned non-JSON: ${text.substring(0, 100)}`);
        }

        if (!VALID_STATUSES.includes(parsed.status)) {
            throw new Error(`Unexpected status: ${parsed.status}`);
        }

        parsed.role = parsed.role || null;
        parsed.company = parsed.company || null;

        if (this._cache.size >= CACHE_MAX_SIZE) {
            this._cache.delete(this._cache.keys().next().value);
        }
        this._cache.set(cacheKey, parsed);

        console.log("🦙 LocalLLM email:", parsed);
        return parsed;
    },

    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};

export default LocalLLM;
