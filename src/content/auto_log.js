// auto_log.js - Detects successful job applications

const DEBUG = true;

const SUCCESS_PATTERNS = [
    /application submitted/i,
    /thank you for applying/i,
    /application received/i,
    /successfully submitted/i,
    /received your application/i
];

function log(msg, data) {
    if (DEBUG) console.log(`[Appli.io AutoLog] ${msg}`, data || '');
}

function detectSuccess() {
    const bodyText = document.body.innerText;

    // Quick scan for success phrases
    const isSuccess = SUCCESS_PATTERNS.some(pattern => pattern.test(bodyText));

    if (isSuccess) {
        log("Success detected!");

        // Extract Details
        const jobDetails = extractJobDetails();

        if (jobDetails) {
            log("Job Details found:", jobDetails);

            // Send to Background
            chrome.runtime.sendMessage({
                action: "SAVE_JOB_FROM_CONTENT",
                data: jobDetails
            }, (response) => {
                log("Background response:", response);
            });
        }
    }
}

function extractJobDetails() {
    let company = "Unknown Company";
    let role = "Unknown Role";

    const domain = window.location.hostname;
    const title = document.title; // e.g., "Software Engineer at Google"

    // Strategy 1: Parse Document Title (Best for ATS)
    // Greenhouse: "Software Engineer at Google"
    // Lever: "Google - Software Engineer"

    if (domain.includes('greenhouse.io')) {
        // usually "Job Title at Company"
        const parts = title.split(' at ');
        if (parts.length >= 2) {
            role = parts[0].trim();
            company = parts[1].replace(/ - .*/, '').trim(); // Remove " - Greenhouse"
        }
    } else if (domain.includes('lever.co')) {
        // usually "Company - Job Title"
        const parts = title.split(' - ');
        if (parts.length >= 2) {
            company = parts[0].trim();
            role = parts[1].trim();
        }
    } else if (domain.includes('ashbyhq.com')) {
        // varies, try title split
        const parts = title.split(' - ');
        if (parts.length >= 2) {
            role = parts[0].trim();
            company = parts[1].trim();
        }
    } else {
        // Fallback: Try OpenGraph tags
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
        if (ogTitle) {
            role = ogTitle;
        }

        const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content;
        if (ogSiteName) {
            company = ogSiteName;
        }
    }

    if (!role || role === "Unknown Role") {
        // Last ditch: look for h1
        const h1 = document.querySelector('h1');
        if (h1) role = h1.innerText.trim();
    }

    return {
        company,
        role,
        url: window.location.href,
        status: "Applied",
        date: new Date().toISOString()
    };
}

// Run detection on load and on URL changes (for SPAs)
detectSuccess();

let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(detectSuccess, 2000); // Wait for render
    }
}).observe(document, { subtree: true, childList: true });
