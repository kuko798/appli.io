const SPREADSHEET_ID = "1W6k3fbYj-W27kCwV5myjrEPcZ1rmrCSgRvKdBwLDuTY";
const SHEET_NAME = "Applications";

const STATUS_PRIORITY = {
  "Rejected": 0,
  "Applied": 1,
  "Interview": 2,
  "Offer": 3
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "sync") {
    syncEmails().then(() => {
      sendResponse("✅ Sync complete");
    });
    return true;
  }
});

async function syncEmails() {
  const token = await getToken();

  const existing = await getExistingRows(token);
  const emailMap = buildEmailMap(existing);

  const query =
    "subject:(application OR interview OR offer OR rejection)";

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      query
    )}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  if (!data.messages) return;

  for (const msg of data.messages.slice(0, 15)) {
    const email = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());

    const headers = email.payload.headers;
    const subject = getHeader(headers, "Subject");
    const from = getHeader(headers, "From");
    const date = getHeader(headers, "Date");

    const newStatus = detectStatus(subject);
    const company = parseCompany(from);

    if (emailMap[msg.id]) {
      const { row, status } = emailMap[msg.id];
      maybeUpdateStatus(token, row, status, newStatus);
    } else {
      await appendRow(token, [
        msg.id,
        company,
        subject,
        newStatus,
        date,
        new Date().toISOString()
      ]);
    }
  }
}

/* ---------- STATUS LOGIC ---------- */

function detectStatus(text) {
  if (/offer/i.test(text)) return "Offer";
  if (/interview/i.test(text)) return "Interview";
  if (/reject|unfortunately/i.test(text)) return "Rejected";
  return "Applied";
}

async function maybeUpdateStatus(token, row, oldStatus, newStatus) {
  if (
    STATUS_PRIORITY[newStatus] >
    STATUS_PRIORITY[oldStatus]
  ) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!D${row}:F${row}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [[newStatus, null, new Date().toISOString()]]
        })
      }
    );
  }
}

/* ---------- SHEETS ---------- */

async function getExistingRows(token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A2:F`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const data = await res.json();
  return data.values || [];
}

function buildEmailMap(rows) {
  const map = {};
  rows.forEach((row, index) => {
    map[row[0]] = {
      row: index + 2,
      status: row[3] || "Applied"
    };
  });
  return map;
}

async function appendRow(token, row) {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [row] })
    }
  );
}

/* ---------- HELPERS ---------- */

function parseCompany(from) {
  const match = from.match(/@([a-zA-Z0-9-]+)/);
  return match ? match[1] : "Unknown";
}

function getHeader(headers, name) {
  return headers.find(h => h.name === name)?.value || "";
}

function getToken() {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      resolve(token);
    });
  });
}
