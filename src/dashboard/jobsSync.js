/**
 * Optional cross-device sync via the FastAPI `webapp` (Bearer token = same Google account as GIS).
 * Jobs: GET/PUT /api/jobs/bearer. User profile: GET /api/profile/bearer (see userProfileSync.js).
 * Build with: VITE_JOBS_API_BASE=https://your-webapp-host.example.com
 * Server must set APPLI_CORS_ORIGINS to that static origin (and enable HTTPS).
 */

/* global chrome */

const BASE = (import.meta.env.VITE_JOBS_API_BASE || '').trim().replace(/\/$/, '');

let debounceTimer = null;

export function jobsApiBase() {
    return BASE || null;
}

export function isRemoteJobsConfigured() {
    return Boolean(BASE);
}

function readLocalJobs() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
            chrome.storage.local.get('jobs', (r) => resolve(r.jobs || []));
        } else {
            resolve([]);
        }
    });
}

function writeLocalJobs(jobs) {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) {
            chrome.storage.local.set({ jobs }, () => resolve());
        } else {
            resolve();
        }
    });
}

const STATUS_PRIORITY = { Applied: 1, Assessment: 2, Interview: 3, Rejected: 4, Offer: 5 };

function pickBetter(a, b) {
    const pa = STATUS_PRIORITY[a?.status] ?? 0;
    const pb = STATUS_PRIORITY[b?.status] ?? 0;
    if (pb > pa) return b;
    if (pa > pb) return a;
    const da = new Date(a?.lastUpdated || a?.date || 0).getTime();
    const db = new Date(b?.lastUpdated || b?.date || 0).getTime();
    return db >= da ? b : a;
}

/** Merge by job id; for conflicts keep better status / newer lastUpdated. */
export function mergeJobs(local, remote) {
    const map = new Map();
    for (const j of remote || []) {
        if (j != null && j.id != null) map.set(j.id, j);
    }
    for (const j of local || []) {
        if (j == null || j.id == null) continue;
        const ex = map.get(j.id);
        map.set(j.id, ex ? pickBetter(ex, j) : j);
    }
    return Array.from(map.values());
}

async function pushJobsNow() {
    if (!BASE) return;
    const token = localStorage.getItem('appli_token');
    if (!token) return;
    const jobs = await readLocalJobs();
    try {
        const r = await fetch(`${BASE}/api/jobs/bearer`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobs }),
        });
        if (!r.ok) console.warn('[jobsSync] push failed', r.status);
    } catch (e) {
        console.warn('[jobsSync] push error', e);
    }
}

/** Call after local job writes; debounced to batch Gmail sync updates. */
export function scheduleRemoteJobsPush() {
    if (!BASE) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void pushJobsNow();
    }, 1500);
}

/**
 * After login: merge server + this browser, then seed server if it was empty but this device had jobs.
 */
export async function pullRemoteJobsMergeOnLogin() {
    if (!BASE) return;
    const token = localStorage.getItem('appli_token');
    if (!token) return;
    try {
        const r = await fetch(`${BASE}/api/jobs/bearer`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const data = await r.json();
        const remote = Array.isArray(data.jobs) ? data.jobs : [];
        const local = await readLocalJobs();
        const merged = mergeJobs(local, remote);
        await writeLocalJobs(merged);
        if (remote.length === 0 && merged.length > 0) {
            await fetch(`${BASE}/api/jobs/bearer`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobs: merged }),
            });
        }
    } catch (e) {
        console.warn('[jobsSync] pull error', e);
    }
}
