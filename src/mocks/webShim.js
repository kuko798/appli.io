/* eslint-disable no-undef */
/**
 * Web app shim: when `chrome.*` is missing (dashboard in a normal browser), expose a compatible surface
 * backed by localStorage + Google Identity Services so Gmail sync and LocalLLM settings work like production.
 */
import { gmailService } from '../services/gmailService.js';

/** True only in a packaged MV3 extension. Every normal browser tab (Chrome, Edge, Safari, Firefox) must use the shim. */
function isPackagedExtension() {
    try {
        return Boolean(
            typeof chrome !== 'undefined' &&
            chrome.runtime &&
            typeof chrome.runtime.id === 'string' &&
            chrome.runtime.id.length > 0 &&
            chrome.storage &&
            chrome.storage.local
        );
    } catch {
        return false;
    }
}

if (!isPackagedExtension()) {
    console.log('[Web shim] Appli.io browser compatibility layer (web / non-extension)');

    const CLIENT_ID = "1097794489757-qglg0t731aplmm0o3cfq80bgbg4l64rl.apps.googleusercontent.com";

    const TOKEN_KEY = 'appli_token';
    const TOKEN_EXP_KEY = 'appli_token_expires_at';

    function readStoredToken() {
        const expRaw = localStorage.getItem(TOKEN_EXP_KEY);
        if (expRaw && Date.now() >= Number(expRaw)) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(TOKEN_EXP_KEY);
            return null;
        }
        return localStorage.getItem(TOKEN_KEY);
    }

    function storeToken(accessToken, expiresInSec) {
        _token = accessToken;
        window._mockToken = accessToken;
        localStorage.setItem(TOKEN_KEY, accessToken);
        const ttl = (expiresInSec || 3600) * 1000;
        localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + ttl - 60_000));
    }

    // Restore token from localStorage so it survives page navigations
    let _token = readStoredToken();
    if (_token) {
        window._mockToken = _token;
        console.log('[Web shim] Restored token from localStorage');
    }

    const storageMock = (storageType) => ({
        get: (keys, callback) => {
            const result = {};
            const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys));
            keyList.forEach(key => {
                const item = localStorage.getItem(`appli_${storageType}_${key}`);
                try {
                    result[key] = item ? JSON.parse(item) : (typeof keys === 'object' && !Array.isArray(keys) ? keys[key] : undefined);
                } catch (e) { result[key] = item; }
            });
            if (callback) callback(result);
            return Promise.resolve(result);
        },
        set: (items, callback) => {
            Object.keys(items).forEach(key => {
                localStorage.setItem(`appli_${storageType}_${key}`, JSON.stringify(items[key]));
            });
            if (callback) callback();
            return Promise.resolve();
        },
        remove: (keys, callback) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            keyList.forEach(key => localStorage.removeItem(`appli_${storageType}_${key}`));
            if (callback) callback();
            return Promise.resolve();
        }
    });

    window.chrome = {
        storage: {
            local: storageMock('local'),
            sync: storageMock('sync'),
            onChanged: {
                addListener: () => {},
                removeListener: () => {}
            }
        },
        identity: {
            getAuthToken: ({ interactive }, callback) => {
                _token = readStoredToken();
                if (_token) {
                    window._mockToken = _token;
                    callback(_token);
                    return;
                }
                if (!interactive) {
                    callback(null);
                    return;
                }
                // Use Google Identity Services if available
                if (typeof google !== 'undefined' && google.accounts) {
                    const client = google.accounts.oauth2.initTokenClient({
                        client_id: CLIENT_ID,
                        scope: [
                            'https://www.googleapis.com/auth/gmail.readonly',
                            'https://www.googleapis.com/auth/userinfo.email',
                            'https://www.googleapis.com/auth/userinfo.profile',
                        ].join(' '),
                        callback: (response) => {
                            if (response.access_token) {
                                storeToken(response.access_token, response.expires_in);
                                callback(_token);
                            } else {
                                console.warn('[Web shim] GIS token error:', response.error || response);
                                callback(null);
                            }
                        },
                    });
                    client.requestAccessToken();
                } else {
                    const stored = readStoredToken();
                    if (stored) {
                        _token = stored;
                        window._mockToken = stored;
                        callback(stored);
                    } else {
                        console.warn('[Web shim] Google Identity Services not loaded. Add the GIS script to your HTML.');
                        callback(null);
                    }
                }
            },
            removeCachedAuthToken: ({ token }, callback) => {
                _token = null;
                window._mockToken = null;
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(TOKEN_EXP_KEY);
                if (callback) callback();
            }
        },
        runtime: {
            getURL: (path) => path,
            openOptionsPage: () => {
                const url = prompt(
                    "LLM base URL (OpenAI-compatible /v1; e.g. pytorch_chat_server or Ollama)\nLeave empty to cancel.",
                    "http://127.0.0.1:8000"
                );
                if (url === null || !String(url).trim()) return;
                const apiKey = prompt(
                    "Optional Bearer API key — only if your server requires it.\nLeave empty for local models (recommended).",
                    ""
                );
                if (apiKey === null) return;
                window.chrome.storage.sync.set({
                    ollamaUrl: url.trim(),
                    ollamaModel: "Qwen/Qwen2.5-1.5B-Instruct",
                    llmApiKey: String(apiKey).trim()
                }, () => window.location.reload());
            },
            onMessage: { addListener: () => {} },
            sendMessage: (msg, callback) => {
                if (msg.action === "sync") {
                    // Ensure token is available for sync
                    const token = _token || localStorage.getItem('appli_token');
                    if (!token) {
                        if (callback) callback("Error: Not signed in. Please sign in first.");
                        return;
                    }
                    window._mockToken = token;
                    gmailService.startSync(msg.range).then(res => {
                        if (callback) callback(res);
                    });
                }
                if (msg.action === "SAVE_JOB_INTERNAL") {
                    window.chrome.storage.local.get("jobs", (result) => {
                        const jobs = result.jobs || [];
                        const existingIdx = jobs.findIndex(j => j.id === msg.job.id);
                        if (existingIdx !== -1) jobs[existingIdx] = msg.job;
                        else jobs.push(msg.job);
                        window.chrome.storage.local.set({ jobs }, () => {
                            if (callback) callback();
                        });
                    });
                }
            }
        }
    };

    try {
        const pyKey = 'appli_sync_pythonClassifierUrl';
        const raw = localStorage.getItem(pyKey);
        let needPy = true;
        if (raw) {
            try {
                const v = JSON.parse(raw);
                if (typeof v === 'string' && v.trim()) needPy = false;
            } catch {
                needPy = true;
            }
        }
        if (needPy) {
            const def =
                typeof window !== 'undefined' &&
                window.location?.port === '5173' &&
                /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '')
                    ? `${window.location.origin}/appli-classifier`.replace(/\/+$/, '')
                    : 'http://127.0.0.1:8765';
            localStorage.setItem(pyKey, JSON.stringify(def));
            console.info('[Web shim] Python classifier URL default:', def);
        }
    } catch { /* ignore */ }

    // Vite dev: migrate old cloud URLs without a key to the local /appli-llm proxy.
    try {
        if (
            typeof window !== 'undefined' &&
            window.location?.port === '5173' &&
            /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '')
        ) {
            const urlKey = 'appli_sync_ollamaUrl';
            const keyKey = 'appli_sync_llmApiKey';
            const rawUrl = localStorage.getItem(urlKey);
            const rawKey = localStorage.getItem(keyKey);
            let url = null;
            if (rawUrl) {
                try {
                    url = JSON.parse(rawUrl);
                } catch {
                    /* ignore */
                }
            }
            let apiKey = '';
            if (rawKey) {
                try {
                    apiKey = JSON.parse(rawKey);
                } catch {
                    /* ignore */
                }
            }
            const isScitely = typeof url === 'string' && /scitely\.com/i.test(url);
            if (isScitely && !String(apiKey).trim()) {
                const fix = `${window.location.origin}/appli-llm`.replace(/\/+$/, '');
                localStorage.setItem(urlKey, JSON.stringify(fix));
                localStorage.setItem('appli_sync_ollamaModel', JSON.stringify('Qwen/Qwen2.5-1.5B-Instruct'));
                console.info('[Web shim] Migrated LLM URL to Vite proxy (was Scitely without API key):', fix);
            }
        }
    } catch {
        /* ignore */
    }

    // Seed demo data if empty
    if (!localStorage.getItem('appli_local_jobs')) {
        const fakeJobs = [
            { id: 1, company: "Stripe", title: "Frontend Engineer", subject: "Your application to Stripe", status: "Applied", date: new Date().toISOString() },
            { id: 2, company: "Notion", title: "Full Stack Developer", subject: "Interview invitation from Notion", status: "Interview", date: new Date(Date.now() - 86400000).toISOString() },
            { id: 3, company: "Vercel", title: "Software Engineer", subject: "We reviewed your application", status: "Offer", date: new Date(Date.now() - 5 * 86400000).toISOString() },
            { id: 4, company: "Figma", title: "UX Engineer", subject: "Update on your Figma application", status: "Rejected", date: new Date(Date.now() - 12 * 86400000).toISOString() },
        ];
        localStorage.setItem('appli_local_jobs', JSON.stringify(fakeJobs));
    }
}
