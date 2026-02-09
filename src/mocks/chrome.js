/* eslint-disable no-undef */
import { gmailService } from '../services/gmailService.js';

if (typeof chrome === 'undefined' || !chrome.storage) {
    console.log('[Mock] Initializing Chrome API Mock for Web Demo');

    const CLIENT_ID = "1097794489757-u3p40a52bjb2h8hi7t2gspephtluf9ui.apps.googleusercontent.com";
    let _token = null;

    const storageMock = (storageType) => ({
        get: (keys, callback) => {
            const result = {};
            const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys));

            keyList.forEach(key => {
                const item = localStorage.getItem(`appli_${storageType}_${key}`);
                try {
                    result[key] = item ? JSON.parse(item) : (typeof keys === 'object' && !Array.isArray(keys) ? keys[key] : undefined);
                } catch (e) {
                    result[key] = item;
                }
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
            keyList.forEach(key => {
                localStorage.removeItem(`appli_${storageType}_${key}`);
            });
            if (callback) callback();
            return Promise.resolve();
        }
    });

    window.chrome = {
        storage: {
            local: storageMock('local'),
            sync: storageMock('sync'),
            onChanged: {
                addListener: (cb) => { console.log('[Mock] Added storage listener'); },
                removeListener: (cb) => { console.log('[Mock] Removed storage listener'); }
            }
        },
        identity: {
            getAuthToken: ({ interactive }, callback) => {
                if (_token) {
                    callback(_token);
                    return;
                }

                if (!interactive) {
                    callback(null);
                    return;
                }

                const client = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/gmail.readonly',
                    callback: (response) => {
                        if (response.access_token) {
                            _token = response.access_token;
                            window._mockToken = _token; // Feed to gmailService
                            callback(_token);
                        } else {
                            console.error('[Mock] Auth failed:', response);
                            callback(null);
                        }
                    },
                });
                client.requestAccessToken();
            }
        },
        runtime: {
            getURL: (path) => path, // Just return the path as-is for web
            openOptionsPage: () => {
                const key = prompt("Enter a simulated API Key (or leave blank):", "gsk_demo_key_123");
                if (key !== null) {
                    window.chrome.storage.sync.set({ groqApiKey: key }, () => window.location.reload());
                }
            },
            onMessage: { addListener: () => { } },
            sendMessage: (msg, callback) => {
                console.log('[Mock] Message sent:', msg.action);

                if (msg.action === "sync") {
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

    // Seed some fake data for the demo if empty
    if (!localStorage.getItem('appli_local_jobs')) {
        const fakeJobs = [
            { id: 1, company: "TechCorp", role: "Frontend Engineer", status: "Applied", date: new Date().toISOString() },
            { id: 2, company: "StartupX", role: "Full Stack Dev", status: "Interview", date: new Date(Date.now() - 86400000).toISOString() }
        ];
        localStorage.setItem('appli_local_jobs', JSON.stringify(fakeJobs));
    }
}
