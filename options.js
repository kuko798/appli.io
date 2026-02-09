// Saves options to chrome.storage
const saveOptions = () => {
    const groqApiKey = document.getElementById('groqApiKey').value;

    chrome.storage.sync.set(
        {
            groqApiKey: groqApiKey
        },
        () => {
            // Update status to let user know options were saved.
            const status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        }
    );
};

// Restores state from chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get(
        {
            groqApiKey: ''
        },
        (items) => {
            document.getElementById('groqApiKey').value = items.groqApiKey;
        }
    );
};

// Verifies the API key with a real request
const verifyKey = async () => {
    const apiKey = document.getElementById('groqApiKey').value;
    const statusEl = document.getElementById('keyStatus');

    if (!apiKey) {
        statusEl.textContent = '⚠ Please enter a key to verify.';
        statusEl.style.color = '#f59e0b';
        return;
    }

    statusEl.innerHTML = '⟳ Verifying connection...';
    statusEl.style.color = '#6b7280';

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: "ping" }],
                max_tokens: 1
            }),
        });

        if (response.ok) {
            statusEl.textContent = '✅ Connection Secure. Key is valid.';
            statusEl.style.color = '#10b981';
        } else {
            const data = await response.json();
            statusEl.textContent = `❌ Connection Rejected: ${data.error?.message || 'Invalid Key'}`;
            statusEl.style.color = '#ef4444';
        }
    } catch (e) {
        statusEl.textContent = '❌ Network Error. Check internet connection.';
        statusEl.style.color = '#ef4444';
    }
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('verify').addEventListener('click', verifyKey);
