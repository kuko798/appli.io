/* eslint-disable no-undef */

if (typeof chrome === 'undefined' || !chrome.storage) {
    console.log('[Mock] Initializing Chrome API Mock for Web Demo');

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
        runtime: {
            getURL: (path) => path, // Just return the path as-is for web
            openOptionsPage: () => {
                alert('[Demo Mode] In the real extension, this opens settings.\n\nFor this demo, we can simulate updating the API key right here.');
                const key = prompt("Enter a simulated API Key (or leave blank to test 'missing key' state):", "gsk_demo_key_123");
                if (key !== null) {
                    window.chrome.storage.sync.set({ groqApiKey: key }, () => {
                        window.location.reload();
                    });
                }
            },
            onMessage: {
                addListener: () => { }
            }
        }
    };

    // Seed some fake data for the demo if empty
    if (!localStorage.getItem('appli_local_jobs')) {
        const fakeJobs = [
            { id: 1, company: "TechCorp", role: "Frontend Engineer", status: "Applied", date: new Date().toISOString() },
            { id: 2, company: "StartupX", role: "Full Stack Dev", status: "Interview", date: new Date(Date.now() - 86400000).toISOString() },
            { id: 3, company: "BigData Inc", role: "Data Analyst", status: "Rejected", date: new Date(Date.now() - 172800000).toISOString() }
        ];
        localStorage.setItem('appli_local_jobs', JSON.stringify(fakeJobs));
    }
}
