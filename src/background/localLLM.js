/**
 * localLLM.js
 *
 * Email classification (Gmail sync):
 * - Uses the Python classifier only: POST {subject, body} to `{pythonClassifierUrl}/classify`.
 * - Configure `pythonClassifierUrl` via sync storage (web shim: localStorage). Dev on Vite :5173 defaults
 *   to same-origin /appli-classifier (see vite.config.js).
 *
 * Interview simulator, resume tools, etc. use `generate` / `generateJSON` against OpenAI-compatible `ollamaUrl`
 * (pytorch_chat_server, hosted APIs, etc.).
 */

const OPENAI_CHAT_PATH = "chat/completions";
const OPENAI_MODELS_PATH = "models";

const MAX_RETRIES = 3;
const EMAIL_MAX_RETRIES = 4;
const EMAIL_SERVER_WAIT_MS = 20000;
const RETRY_BASE_DELAY = 700;
const REQUEST_TIMEOUT = 90000;
const LARGE_MODEL_TIMEOUT = 240000;
/** Local PyTorch / Ollama on CPU can exceed 90s for ~1–2k tokens; hosted APIs stay fast. */
/** Full resume rewrites on CPU can exceed 10–15 min; keep above Vite /appli-llm proxy timeout. */
const LOCAL_LLM_CHAT_TIMEOUT_MS = 1_800_000;
const CACHE_MAX_SIZE = 500;
const MIN_REQUEST_INTERVAL = 60;
const MAX_EMAIL_BODY_CHARS = 2200;
const LARGE_MODEL_HINTS = ["65b", "70b", "72b", "90b"];

const VALID_STATUSES = ["Applied", "Assessment", "Interview", "Offer", "Rejected", null];
/** Local OpenAI-compatible chat (pytorch_chat_server, Ollama shim, etc.) — Chrome extension service worker. */
const DEFAULT_LLM_BASE_EXTENSION = "http://localhost:8000";
const DEFAULT_LLM_MODEL = "Qwen/Qwen2.5-1.5B-Instruct";
/** Browser tab without Vite proxy (e.g. static preview of the dashboard). */
const DEFAULT_LLM_BASE_BROWSER = "http://127.0.0.1:8000";
/** Empty = no Authorization header (correct for local Ollama / pytorch_chat_server). */
const DEFAULT_API_KEY = "";
const LOCAL_FALLBACK_BASE_URL = "http://localhost:11434";

/** True only in a packaged Chrome extension (has MV3 runtime id). The web app uses a shim without `runtime.id`. */
function hasExtensionRuntime() {
    try {
        return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch {
        return false;
    }
}

/** Base URL for python_classifier (no trailing slash). Service worker has no `window` → always :8765. */
function defaultPythonClassifierBase() {
    try {
        if (typeof window !== "undefined" && window.location?.port === "5173") {
            const h = window.location.hostname || "";
            if (h === "localhost" || h === "127.0.0.1") {
                return `${window.location.origin}/appli-classifier`.replace(/\/+$/, "");
            }
        }
    } catch {
        /* ignore */
    }
    return "http://127.0.0.1:8765";
}

/**
 * Vite dev dashboard (localhost:5173): same-origin proxy to pytorch_chat_server (see vite.config.js).
 * Avoids CORS when calling a local chat server from the browser.
 */
function defaultLlmBaseForViteDev() {
    try {
        if (typeof window !== "undefined" && window.location?.port === "5173") {
            const h = window.location.hostname || "";
            if (h === "localhost" || h === "127.0.0.1") {
                return `${window.location.origin}/appli-llm`.replace(/\/+$/, "");
            }
        }
    } catch {
        /* ignore */
    }
    return null;
}

function syncStorageDefaults() {
    const pythonClassifierUrl = defaultPythonClassifierBase();
    if (hasExtensionRuntime()) {
        return {
            ollamaUrl: DEFAULT_LLM_BASE_EXTENSION,
            ollamaModel: DEFAULT_LLM_MODEL,
            llmApiKey: DEFAULT_API_KEY,
            pythonClassifierUrl
        };
    }
    const viteLlm = defaultLlmBaseForViteDev();
    if (viteLlm) {
        return {
            ollamaUrl: viteLlm,
            ollamaModel: DEFAULT_LLM_MODEL,
            llmApiKey: DEFAULT_API_KEY,
            pythonClassifierUrl
        };
    }
    return {
        ollamaUrl: DEFAULT_LLM_BASE_BROWSER,
        ollamaModel: DEFAULT_LLM_MODEL,
        llmApiKey: DEFAULT_API_KEY,
        pythonClassifierUrl
    };
}
const PREFERRED_FREE_MODELS = [
    "Qwen/Qwen2.5-1.5B-Instruct",
    "meta-llama/Llama-3-8B-Instruct",
    "Qwen/Qwen2.5-7B-Instruct",
    "Qwen/Qwen2.5-14B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "google/gemma-2-9b-it"
];

const LocalLLM = {
    _queue: [],
    _processing: false,
    _cache: new Map(),
    _lastRequestTime: 0,
    _settings: null,
    _resolvedModel: null,

    // ─── Settings ────────────────────────────────────────────────────────────

    async getSettings() {
        if (this._settings) return this._settings;
        console.log("[LocalLLM] Loading settings from sync storage…");
        return new Promise((resolve) => {
            const defs = syncStorageDefaults();
            chrome.storage.sync.get(defs, (items) => {
                const normalized = {
                    ...items,
                    ollamaUrl: this._normalizeBaseUrl(items.ollamaUrl || defs.ollamaUrl),
                    ollamaModel: (items.ollamaModel || defs.ollamaModel).trim(),
                    llmApiKey: (items.llmApiKey || "").trim(),
                    pythonClassifierUrl: String(items.pythonClassifierUrl || "").trim().replace(/\/+$/, "")
                };
                this._settings = normalized;
                console.log("[LocalLLM] Settings loaded:", {
                    url: normalized.ollamaUrl,
                    model: normalized.ollamaModel,
                    bearerTokenSet: Boolean(normalized.llmApiKey),
                    pythonClassifier: Boolean(normalized.pythonClassifierUrl)
                });
                resolve(normalized);
            });
        });
    },

    resetSettings() {
        console.log("[LocalLLM] Settings cache cleared");
        this._settings = null;
        this._resolvedModel = null;
    },

    // ─── Availability ────────────────────────────────────────────────────────

    async isAvailable() {
        try {
            const { ollamaUrl, ollamaModel, llmApiKey, pythonClassifierUrl } = await this.getSettings();
            if (pythonClassifierUrl) {
                const healthUrl = `${pythonClassifierUrl}/health`;
                console.log(`[LocalLLM] Checking Python classifier at ${healthUrl}...`);
                const h = await fetch(healthUrl, {
                    headers: this._buildHeaders(llmApiKey, false, healthUrl),
                    signal: AbortSignal.timeout(5000)
                });
                if (h.ok) {
                    console.log("[LocalLLM] Python classifier is reachable");
                    return true;
                }
                console.warn("[LocalLLM] Python classifier health check failed:", h.status);
                return false;
            }
            const modelsUrl = this._buildApiUrl(ollamaUrl, OPENAI_MODELS_PATH);
            console.log(`[LocalLLM] Checking availability at ${modelsUrl}...`);
            const response = await fetch(modelsUrl, {
                headers: this._buildHeaders(llmApiKey, false, modelsUrl),
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) {
                console.warn("[LocalLLM] isAvailable: server responded with", response.status);
                return false;
            }
            const data = await response.json();
            console.log("[LocalLLM] Available models:", data.data?.map(m => m.id));
            const found = (data.data || []).some(
                (m) => m.id === ollamaModel || m.id.startsWith(ollamaModel)
            );
            console.log(`[LocalLLM] Model "${ollamaModel}" found:`, found);
            return found;
        } catch (err) {
            console.warn("[LocalLLM] isAvailable check failed:", err.message);
            return false;
        }
    },

    async listModels() {
        try {
            const { ollamaUrl, llmApiKey } = await this.getSettings();
            const modelsUrl = this._buildApiUrl(ollamaUrl, OPENAI_MODELS_PATH);
            console.log(`[LocalLLM] Listing models from ${modelsUrl}`);
            const response = await fetch(modelsUrl, {
                headers: this._buildHeaders(llmApiKey, false, modelsUrl),
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) return [];
            const data = await response.json();
            const models = (data.data || []).map((m) => m.id);
            console.log("[LocalLLM] listModels result:", models);
            return models;
        } catch (err) {
            console.warn("[LocalLLM] listModels failed:", err.message);
            return [];
        }
    },

    // ─── Public: Email analysis ──────────────────────────────────────────────

    /**
     * @param {string} [fromHeader] - Raw "From" header (helps Python extract employer domain / company).
     */
    async analyzeEmail(subject, body, fromHeader = "") {
        const cacheKey = this._makeCacheKey(subject, body, fromHeader);
        if (this._cache.has(cacheKey)) {
            console.log("[LocalLLM] Cache hit for email:", subject?.substring(0, 60));
            return this._cache.get(cacheKey);
        }

        const { pythonClassifierUrl } = await this.getSettings();
        const base = String(pythonClassifierUrl || "").trim().replace(/\/+$/, "");
        if (!base) {
            throw new Error(
                "Gmail classification uses the Python classifier only. Set Python classifier base URL in sync storage (e.g. http://127.0.0.1:8765) and run python_classifier/service.py."
            );
        }

        console.log("[LocalLLM] Queuing Python classifier:", subject?.substring(0, 60));
        return this._enqueue(() => this._classifyWithPythonService(subject, body, fromHeader, cacheKey));
    },

    // ─── Public: Generation ──────────────────────────────────────────────────

    async generate({ system = null, messages, temperature = 0.5, maxTokens = 2000, model = null }) {
        console.log("[LocalLLM] generate() called, messages:", messages.length, "temperature:", temperature);
        return this._withRetry(() =>
            this._chatRequest({ system, messages, temperature, maxTokens, model, jsonMode: false })
        );
    },

    async generateJSON({ system = null, messages, temperature = 0.25, maxTokens = 4000, model = null }) {
        console.log("[LocalLLM] generateJSON() called, maxTokens:", maxTokens, "temperature:", temperature);
        const text = await this._withRetry(() =>
            this._chatRequest({ system, messages, temperature, maxTokens, model, jsonMode: true })
        );
        console.log("[LocalLLM] generateJSON raw response (first 500 chars):", text.substring(0, 500));
        const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        try {
            const parsed = JSON.parse(stripped);
            console.log("[LocalLLM] generateJSON parsed successfully");
            return parsed;
        } catch {
            const match = stripped.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[0]);
                    console.log("[LocalLLM] generateJSON parsed via regex extraction");
                    return parsed;
                } catch { }
            }
            console.error("[LocalLLM] generateJSON failed to parse:", stripped.substring(0, 200));
            const err = new Error(`Model returned unparseable JSON. Preview: ${stripped.substring(0, 120)}`);
            err.rawText = stripped;
            throw err;
        }
    },

    clearCache() {
        console.log("[LocalLLM] Cache cleared");
        this._cache.clear();
    },

    // ─── Private: Retry ──────────────────────────────────────────────────────

    async _withRetry(fn) {
        let lastError;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 120;
                console.log(`[LocalLLM] Retry ${attempt}/${MAX_RETRIES - 1} in ${Math.round(delay)}ms...`);
                await this._sleep(delay);
            }
            try {
                return await fn();
            } catch (err) {
                console.warn(`[LocalLLM] Attempt ${attempt + 1} failed:`, err.message);
                lastError = err;
                if (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404) {
                    console.error("[LocalLLM] Non-retryable error, giving up");
                    throw err;
                }
            }
        }
        throw lastError;
    },

    async _withEmailRetry(fn) {
        let lastError;
        for (let attempt = 0; attempt < EMAIL_MAX_RETRIES; attempt++) {
            try {
                return await fn();
            } catch (err) {
                console.warn(`[LocalLLM] Email retry attempt ${attempt + 1} failed:`, err.message);
                lastError = err;
                if (err.status === 503 || err.status === 408) {
                    const wait = EMAIL_SERVER_WAIT_MS * (attempt + 1);
                    console.warn(`[LocalLLM] Server unreachable, waiting ${wait / 1000}s before retry ${attempt + 1}/${EMAIL_MAX_RETRIES - 1}...`);
                    await this._sleep(wait);
                } else {
                    throw err;
                }
            }
        }
        throw lastError;
    },

    // ─── Private: HTTP ───────────────────────────────────────────────────────

    async _chatRequest({ system, messages, temperature, maxTokens, model, jsonMode }) {
        const { ollamaUrl, ollamaModel, llmApiKey } = await this.getSettings();
        const allMessages = [];
        if (system) allMessages.push({ role: "system", content: system });
        allMessages.push(...messages);

        const performRequest = async ({ baseUrl, activeModel }) => {
            const url = this._buildApiUrl(baseUrl, OPENAI_CHAT_PATH);
            const requestTimeout = this._getChatRequestTimeout(activeModel, baseUrl);
            const body = {
                model: activeModel,
                messages: allMessages,
                temperature,
                max_tokens: maxTokens,
                stream: false
            };
            if (jsonMode) {
                body.response_format = { type: "json_object" };
            }

            console.log(`[LocalLLM] POST ${url}`);
            console.log("[LocalLLM] Request body:", JSON.stringify({
                model: activeModel,
                temperature,
                max_tokens: maxTokens,
                jsonMode,
                messageCount: allMessages.length,
                firstMessagePreview: allMessages[0]?.content?.substring(0, 100)
            }));

            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`[LocalLLM] Request timed out after ${requestTimeout}ms`);
                controller.abort();
            }, requestTimeout);

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: this._buildHeaders(llmApiKey, true, url),
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const text = await response.text().catch(() => "");
                    const err = new Error(text || `LLM provider error ${response.status}`);
                    err.status = response.status;
                    err.responseText = text;
                    throw err;
                }

                const data = await response.json();
                const content = (data.choices?.[0]?.message?.content || "").trim();
                if (!content) throw new Error("LLM provider returned empty content");
                return content;
            } catch (err) {
                clearTimeout(timeoutId);
                if (err.name === "AbortError") {
                    const timeoutErr = new Error("LLM request timed out.");
                    timeoutErr.status = 408;
                    throw timeoutErr;
                }
                throw err;
            }
        };

        const configuredModel = model || ollamaModel;
        try {
            return await performRequest({ baseUrl: ollamaUrl, activeModel: configuredModel });
        } catch (err) {
            const isNetworkError =
                err.message?.includes("fetch") ||
                err.message?.includes("network") ||
                err.message?.includes("Failed to fetch");

            // Ollama :11434 from a normal tab hits CORS; only the extension service worker can fall back here.
            if (
                isNetworkError &&
                ollamaUrl.includes("localhost:8000") &&
                hasExtensionRuntime()
            ) {
                console.warn("[LocalLLM] Falling back to local endpoint:", LOCAL_FALLBACK_BASE_URL);
                const fallbackModel = await this._resolveBestModel().catch(() => configuredModel);
                return await performRequest({ baseUrl: LOCAL_FALLBACK_BASE_URL, activeModel: fallbackModel });
            }

            // If model is missing on provider, retry once with best available model.
            if (err.status === 404 || err.status === 422) {
                const fallbackModel = await this._resolveBestModel().catch(() => configuredModel);
                if (fallbackModel && fallbackModel !== configuredModel) {
                    console.warn(`[LocalLLM] Retrying with available model: ${fallbackModel}`);
                    return await performRequest({ baseUrl: ollamaUrl, activeModel: fallbackModel });
                }
            }

            if (isNetworkError) {
                const networkErr = new Error("Cannot reach the configured LLM provider.");
                networkErr.status = 503;
                throw networkErr;
            }
            console.error("[LocalLLM] _chatRequest error:", err.message);
            throw err;
        }
    },

    // ─── Private: Cache ──────────────────────────────────────────────────────

    _makeCacheKey(subject, body, fromHeader = "") {
        const s = (subject || "").substring(0, 180).toLowerCase().trim();
        const b = (body || "").substring(0, 500).toLowerCase().trim();
        const f = (fromHeader || "").substring(0, 120).toLowerCase().trim();
        return `${s}||${b}||${f}`;
    },

    _setCache(key, value) {
        if (this._cache.size >= CACHE_MAX_SIZE) {
            this._cache.delete(this._cache.keys().next().value);
        }
        this._cache.set(key, value);
        console.log(`[LocalLLM] Cached result. Cache size: ${this._cache.size}`);
    },

    // ─── Private: Queue ──────────────────────────────────────────────────────

    _enqueue(fn) {
        console.log(`[LocalLLM] Enqueued task. Queue size: ${this._queue.length + 1}`);
        return new Promise((resolve, reject) => {
            this._queue.push({ fn, resolve, reject });
            if (!this._processing) this._processQueue();
        });
    },

    async _processQueue() {
        if (this._processing) return;
        this._processing = true;
        console.log("[LocalLLM] Starting queue processing...");
        while (this._queue.length > 0) {
            const elapsed = Date.now() - this._lastRequestTime;
            if (elapsed < MIN_REQUEST_INTERVAL) {
                await this._sleep(MIN_REQUEST_INTERVAL - elapsed);
            }
            console.log(`[LocalLLM] Processing queue item. Remaining: ${this._queue.length}`);
            const { fn, resolve, reject } = this._queue.shift();
            try {
                resolve(await fn());
            } catch (err) {
                console.error("[LocalLLM] Queue item failed:", err.message);
                reject(err);
            }
            this._lastRequestTime = Date.now();
        }
        this._processing = false;
        console.log("[LocalLLM] Queue processing complete");
    },

    // ─── Private: Email classification (Python service only) ──────────────

    _normalizeClassificationParsed(parsed) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {
                status: null,
                role: null,
                company: null,
                reason: null,
                confidence: this._normalizeConfidence(undefined),
                signals: [],
                nextAction: null,
                summary: null
            };
        }
        let status = parsed.status;
        if (!VALID_STATUSES.includes(status)) {
            console.warn("[LocalLLM] Invalid status from model:", status, "→ setting null");
            status = null;
        }
        const normalized = {
            status,
            role: typeof parsed.role === "string" ? parsed.role.trim() || null : null,
            company: typeof parsed.company === "string" ? parsed.company.trim() || null : null,
            reason: typeof parsed.reason === "string" ? parsed.reason.trim() || null : null,
            confidence: this._normalizeConfidence(parsed.confidence),
            signals: Array.isArray(parsed.signals) ? parsed.signals.filter((s) => typeof s === "string" && s).slice(0, 4) : [],
            nextAction: typeof parsed.nextAction === "string" ? parsed.nextAction.trim() || null : null,
            summary: typeof parsed.summary === "string" ? parsed.summary.trim() || null : null
        };
        if (!normalized.reason && normalized.status) {
            normalized.reason = this._defaultReasonForStatus(normalized.status);
        }
        if (!normalized.summary && normalized.reason) {
            normalized.summary = normalized.reason;
        }
        return normalized;
    },

    async _classifyWithPythonService(subject, body, fromHeader, cacheKey) {
        const { pythonClassifierUrl, llmApiKey } = await this.getSettings();
        const url = `${pythonClassifierUrl}/classify`;
        const truncatedBody =
            body.length > MAX_EMAIL_BODY_CHARS
                ? body.substring(0, MAX_EMAIL_BODY_CHARS) + "\n...[truncated]"
                : body;

        const run = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);
            try {
                const payload = { subject: subject || "", body: truncatedBody };
                if (fromHeader && String(fromHeader).trim()) {
                    payload.from = String(fromHeader).trim().slice(0, 500);
                }
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...this._buildHeaders(llmApiKey, false, url)
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const text = await response.text().catch(() => "");
                    const err = new Error(text || `Python classifier error ${response.status}`);
                    err.status = response.status;
                    throw err;
                }

                const data = await response.json();
                const normalized = this._normalizeClassificationParsed({
                    status: data.status,
                    role: data.role,
                    company: data.company,
                    reason: data.reason,
                    confidence: data.confidence,
                    signals: data.signals,
                    nextAction: data.nextAction,
                    summary: data.summary
                });
                console.log(
                    `[LocalLLM] Python classifier result for "${subject?.substring(0, 40)}":`,
                    normalized
                );
                this._setCache(cacheKey, normalized);
                return normalized;
            } catch (err) {
                clearTimeout(timeoutId);
                if (err.name === "AbortError") {
                    const t = new Error("Python classifier request timed out.");
                    t.status = 408;
                    throw t;
                }
                throw err;
            }
        };

        return this._withEmailRetry(run);
    },

    // ─── Private: Helpers ────────────────────────────────────────────────────

    _buildHeaders(apiKey, includeJson = false, requestUrl = "") {
        const headers = {};
        const u = String(requestUrl || "");
        if (/ngrok/i.test(u)) {
            headers["ngrok-skip-browser-warning"] = "true";
        }
        if (includeJson) {
            headers["Content-Type"] = "application/json";
        }
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }
        return headers;
    },

    _buildApiUrl(baseUrl, resourcePath) {
        const base = String(baseUrl || "").trim().replace(/\/+$/, "");
        const path = String(resourcePath || "").replace(/^\/+/, "");
        if (!base) return `/v1/${path}`;
        if (/\/v\d+$/i.test(base)) {
            return `${base}/${path}`;
        }
        return `${base}/v1/${path}`;
    },

    _normalizeBaseUrl(rawUrl) {
        const cleaned = String(rawUrl || "").trim().replace(/\/+$/, "");
        if (!cleaned) return syncStorageDefaults().ollamaUrl;
        return cleaned.replace(/(\/v\d+)(?:\/v\d+)+$/i, "$1");
    },

    _isLargeModel(modelName) {
        const name = (modelName || "").toLowerCase();
        return LARGE_MODEL_HINTS.some((hint) => name.includes(hint));
    },

    _isLocalLlmBaseUrl(baseUrl) {
        const s = String(baseUrl || "").toLowerCase();
        if (!s) return false;
        if (s.includes("/appli-llm")) return true;
        try {
            const u = new URL(s);
            const h = u.hostname;
            return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
        } catch {
            return /localhost|127\.0\.0\.1/.test(s);
        }
    },

    _getChatRequestTimeout(modelName, baseUrl) {
        if (this._isLocalLlmBaseUrl(baseUrl)) {
            return LOCAL_LLM_CHAT_TIMEOUT_MS;
        }
        return this._isLargeModel(modelName) ? LARGE_MODEL_TIMEOUT : REQUEST_TIMEOUT;
    },

    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    },

    _defaultReasonForStatus(status) {
        if (status === "Rejected") return "The wording indicates the application will not move forward.";
        if (status === "Interview") return "It mentions scheduling or a next-round discussion.";
        if (status === "Offer") return "It suggests a positive hiring decision or compensation details.";
        if (status === "Applied") return "It confirms receipt of the application.";
        if (status === "Assessment") return "It describes a coding test, take-home, or async assessment step.";
        return null;
    },

    _normalizeConfidence(value) {
        const n = Number(value);
        if (Number.isNaN(n)) return 0.72;
        return Math.min(1, Math.max(0, n));
    },

    async _resolveBestModel() {
        if (this._resolvedModel) return this._resolvedModel;
        const { ollamaModel } = await this.getSettings();
        const available = await this.listModels();
        if (!available.length) {
            this._resolvedModel = ollamaModel || syncStorageDefaults().ollamaModel;
            return this._resolvedModel;
        }

        const preferred = [ollamaModel, ...PREFERRED_FREE_MODELS].filter(Boolean);
        for (const candidate of preferred) {
            const exact = available.find((m) => m === candidate);
            if (exact) {
                this._resolvedModel = exact;
                return exact;
            }
            const prefix = available.find((m) => m.startsWith(candidate));
            if (prefix) {
                this._resolvedModel = prefix;
                return prefix;
            }
        }

        this._resolvedModel = available[0];
        return this._resolvedModel;
    }
};

export default LocalLLM;
