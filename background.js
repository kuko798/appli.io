importScripts('groq.js');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "sync") {
    startSync(msg.range).then((result) => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
});

async function startSync(range) {
  try {
    await syncEmails(range);
    return "✅ Sync complete";
  } catch (error) {
    console.error("Sync error:", error);

    // DEBUG: Notify user of failure
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Debug Access',
      message: 'Could not find email or access failed.'
    });

    return "❌ Error: " + error.message;
  }
}

async function syncEmails(range = "1m") {
  const token = await getToken();
  if (!token) throw new Error("Could not get auth token");

  // Calculate Date
  const dateObj = new Date();
  if (range === "1m") dateObj.setMonth(dateObj.getMonth() - 1);
  if (range === "3m") dateObj.setMonth(dateObj.getMonth() - 3);
  if (range === "6m") dateObj.setMonth(dateObj.getMonth() - 6);
  if (range === "1y") dateObj.setFullYear(dateObj.getFullYear() - 1);

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const afterDate = `${year}/${month}/${day}`;

  // Notify user
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Syncing...',
    message: `Searching emails since ${afterDate}`
  });

  const query = `subject:(application OR interview OR offer OR rejection) after:${afterDate}`;
  let nextPageToken = null;
  let pageCount = 0;

  do {
    pageCount++;
    console.log(`Fetching page ${pageCount}...`);

    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`;
    if (nextPageToken) {
      url += `&pageToken=${nextPageToken}`;
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (data.messages && data.messages.length > 0) {
      for (const msg of data.messages) {
        try {
          const email = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json());

          const headers = email.payload.headers;
          const subject = getHeader(headers, "Subject");
          const from = getHeader(headers, "From");
          const snippet = email.snippet || "";
          const fullBody = extractBody(email.payload) || snippet;
          const date = getHeader(headers, "Date");

          // 1. FILTER: Skip promotional emails
          if (isPromotional(subject, fullBody, from)) {
            console.log("Skipping promotional:", subject);
            continue;
          }

          // 2-5. INTELLIGENCE: Groq (LLaMA 3.3)
          let newStatus = "Applied";
          let extractedRole = null;
          let extractedCompany = null;

          try {
            const settings = await new Promise(resolve => {
              chrome.storage.sync.get({
                groqApiKey: ''
              }, resolve);
            });

            const analysis = await Groq.analyzeEmail(settings.groqApiKey, subject, fullBody);

            newStatus = analysis.status || "Applied";
            extractedRole = analysis.role;
            extractedCompany = analysis.company;
            console.log(`✨ Groq Analysis for "${subject.substring(0, 30)}...":`, analysis);
          } catch (error) {
            console.error("Groq Analysis error:", error);
            continue; // Skip if analysis fails
          }

          // Filter if Gemini found nothing
          if (!extractedRole) {
            console.log("Skipping - no role found:", subject);
            continue;
          }

          if (!extractedCompany) {
            const details = extractJobDetails(from, subject);
            extractedCompany = details.company;
          }

          // 3. SAVE: Handle de-duplication
          await saveJob({
            id: msg.id,
            company: extractedCompany,
            title: extractedRole,
            subject,
            status: newStatus,
            date,
            lastUpdated: new Date().toISOString()
          });

        } catch (err) {
          console.error("Error processing msg:", msg.id, err);
        }
      }
    }

    nextPageToken = data.nextPageToken;

  } while (nextPageToken);
}

/* ---------- INTELLIGENCE LOGIC ---------- */

function isPromotional(subject, body, from) {
  const s = subject.toLowerCase();
  const f = from.toLowerCase();

  // High-confidence promotional subjects/senders
  const badSubjects = [
    "newsletter", "job recommendations", "digest", "webinar",
    "matches for you", "marketing", "promo", "coursera",
    "discount", "% off", "black friday", "cyber monday",
    "exclusive offer", "save $", "ends soon"
  ];

  if (badSubjects.some(w => s.includes(w))) return true;

  // Check if it's from a known automated alert system that isn't a direct recruiter
  const badSenders = ["noreply@glassdoor.com", "notifications@linkedin.com", "jobalerts-noreply@linkedin.com"];
  if (badSenders.some(w => f.includes(w))) return true;

  return false;
}

// NOTE: calculateStatusScore removed in favor of Classifier.predict in classifier.js


function extractJobDetails(from, subject) {
  // 1. Extract Company from Sender (e.g. "Google <recruiting@google.com>")
  let company = "Unknown";
  const nameMatch = from.match(/^"?([^"<]+)"?/); // Matches "Name" before <email>
  if (nameMatch) {
    company = nameMatch[1].trim();
  } else {
    // Fallback to domain
    const domainMatch = from.match(/@([a-zA-Z0-9-]+)\./);
    if (domainMatch) company = domainMatch[1];
  }

  // Normalize Company (remove Inc, LLC, etc)
  company = company.replace(/,?\s?(Inc|LLC|Ltd|Corp|Corporation)\.?$/i, "").trim();

  // 2. Extract Title from Subject (basic heuristics)
  // Common patterns: "Software Engineer Application", "Application for Data Scientist", "Your application to Frontend Dev"
  let title = subject;
  const cleanSubject = subject.replace(/application|status|update|regarding|for|to|at/gi, " ").trim();

  // Very naive extraction, just use the cleaned subject as a proxy for Title for now.
  // A real extraction would need NLP.
  // Let's try to capture "Role" if explicitly mentioned?
  // For now, let's just clean it up so it's not "Application: Software Engineer" -> "Software Engineer"
  title = cleanSubject.replace(/^[:\-\s]+|[:\-\s]+$/g, "");

  return { company, title };
}

function extractBody(payload) {
  let encoded = "";

  // Recursive function to find text/plain
  function findText(p) {
    if (p.body && p.body.data && p.mimeType === "text/plain") {
      return p.body.data;
    }
    if (p.parts) {
      for (const part of p.parts) {
        const found = findText(part);
        if (found) return found;
      }
    }
    return "";
  }

  if (payload.body && payload.body.data) {
    encoded = payload.body.data;
  } else {
    encoded = findText(payload);
  }

  if (!encoded) return "";

  // Decode Base64Url
  try {
    const input = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(input);
    // Basic UTF-8 decoding
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return "";
  }
}


/* ---------- STORAGE LOGIC ---------- */

async function getStoredJobs() {
  return new Promise((resolve) => {
    chrome.storage.local.get("jobs", (result) => {
      resolve(result.jobs || []);
    });
  });
}

async function saveJob(newJob) {
  const jobs = await getStoredJobs();

  // DE-DUPLICATION STRATEGY:
  // 1. Check by Message ID (Existing logic - exact match)
  const idIndex = jobs.findIndex(j => j.id === newJob.id);

  if (idIndex !== -1) {
    // Found by ID -> Update if status improved
    const oldJob = jobs[idIndex];
    if (STATUS_PRIORITY[newJob.status] > STATUS_PRIORITY[oldJob.status]) {
      jobs[idIndex] = { ...oldJob, ...newJob }; // Merge
      await setStoredJobs(jobs);
    }
    return;
  }

  // 2. Check by (Company + Title) heuristic logic
  // If we have a job for "Google" "Software Engineer" from 2 days ago, and this is "Rejected", it's likely the same job.
  const similarIndex = jobs.findIndex(j => {
    return j.company === newJob.company &&
      Math.abs(new Date(j.date) - new Date(newJob.date)) < 1000 * 60 * 60 * 24 * 60; // Within 60 days
    // Note: We aren't strictly matching title yet because extracting title is hard and prone to mismatch.
    // Matching Company + roughly same time is a safer bet for "same job application".
  });

  if (similarIndex !== -1) {
    const oldJob = jobs[similarIndex];
    // Only update if this new email provides new info (like a status change)
    if (STATUS_PRIORITY[newJob.status] > STATUS_PRIORITY[oldJob.status]) {
      jobs[similarIndex] = { ...oldJob, status: newJob.status, lastUpdated: newJob.lastUpdated };
      await setStoredJobs(jobs);
    } else if (STATUS_PRIORITY[newJob.status] === STATUS_PRIORITY[oldJob.status]) {
      // Same status, different email? Might be a duplicate or just another thread.
      // Let's ignore to prevent duplicate rows.
    }
    return;
  }

  // New Job
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

const STATUS_PRIORITY = {
  "Rejected": 0,
  "Applied": 1,
  "Interview": 2,
  "Offer": 3
};

function getHeader(headers, name) {
  return headers.find(h => h.name === name)?.value || "";
}

function getToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      resolve(token);
    });
  });
}
