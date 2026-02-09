import Groq from './groq.js';
import { gmailService } from '../services/gmailService.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "sync") {
        gmailService.startSync(msg.range).then((result) => {
            sendResponse(result);
        });
        return true;
    }

    if (msg.action === "SAVE_JOB_INTERNAL") {
        saveJob(msg.job).then(() => sendResponse("success"));
        return true;
    }

    if (msg.action === "SAVE_JOB_FROM_CONTENT") {
        saveJob({
            id: "AUTO_" + Date.now(),
            company: msg.data.company,
            title: msg.data.role,
            subject: `[Auto-Log] Application to ${msg.data.company}`,
            status: "Applied",
            date: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        }).then(() => {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'Application Logged! 🚀',
                message: `Saved: ${msg.data.role} at ${msg.data.company}`
            });
            sendResponse("success");
        });
        return true;
    }
});



/* ---------- STORAGE LOGIC ---------- */

async function getStoredJobs() {
    return new Promise((resolve) => {
        chrome.storage.local.get("jobs", (result) => {
            resolve(result.jobs || []);
        });
    });
}

const STATUS_PRIORITY = {
    "Rejected": 0,
    "Applied": 1,
    "Interview": 2,
    "Offer": 3
};

async function saveJob(newJob) {
    const jobs = await getStoredJobs();

    // DE-DUPLICATION STRATEGY
    const idIndex = jobs.findIndex(j => j.id === newJob.id);
    if (idIndex !== -1) {
        const oldJob = jobs[idIndex];
        if (STATUS_PRIORITY[newJob.status] > STATUS_PRIORITY[oldJob.status]) {
            jobs[idIndex] = { ...oldJob, ...newJob };
            await setStoredJobs(jobs);
        }
        return;
    }

    const similarIndex = jobs.findIndex(j => {
        return j.company === newJob.company &&
            Math.abs(new Date(j.date) - new Date(newJob.date)) < 1000 * 60 * 60 * 24 * 60; // 60 days
    });

    if (similarIndex !== -1) {
        const oldJob = jobs[similarIndex];
        if (STATUS_PRIORITY[newJob.status] > STATUS_PRIORITY[oldJob.status]) {
            jobs[similarIndex] = { ...oldJob, status: newJob.status, lastUpdated: newJob.lastUpdated };
            await setStoredJobs(jobs);
        }
        return;
    }

    jobs.push(newJob);
    await setStoredJobs(jobs);
}

function setStoredJobs(jobs) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ jobs: jobs }, () => {
            resolve();
        });
    });
}

function getToken() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            resolve(token);
        });
    });
}
