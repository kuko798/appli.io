const TAGS_PATH = "/api/tags";

const getEl = (id) => document.getElementById(id);

// ── Restore saved settings ────────────────────────────────────────────────────
const restoreOptions = () => {
    chrome.storage.sync.get(
        { ollamaUrl: "http://localhost:11434", ollamaModel: "llama3.2:1b" },
        (items) => {
            getEl("ollamaUrl").value = items.ollamaUrl;
            getEl("ollamaModel").value = items.ollamaModel;
        }
    );
};

// ── Save settings ─────────────────────────────────────────────────────────────
const saveOptions = () => {
    const ollamaUrl = getEl("ollamaUrl").value.trim().replace(/\/$/, "");
    const ollamaModel = getEl("ollamaModel").value.trim();

    chrome.storage.sync.set({ ollamaUrl, ollamaModel }, () => {
        const statusEl = getEl("status");
        statusEl.textContent = "Settings saved.";
        setTimeout(() => { statusEl.textContent = ""; }, 3000);
    });
};

// ── Test connection ───────────────────────────────────────────────────────────
const testConnection = async () => {
    const url = getEl("ollamaUrl").value.trim().replace(/\/$/, "");
    const model = getEl("ollamaModel").value.trim();
    const statusEl = getEl("connectionStatus");

    statusEl.textContent = "⟳ Connecting to Ollama...";
    statusEl.style.color = "#6b7280";

    try {
        const response = await fetch(`${url}${TAGS_PATH}`, {
            signal: AbortSignal.timeout(6000)
        });

        if (!response.ok) {
            statusEl.textContent = `❌ Ollama returned ${response.status}`;
            statusEl.style.color = "#ef4444";
            return;
        }

        const data = await response.json();
        const models = (data.models || []).map((m) => m.name);
        const modelPulled = models.some(
            (m) => m === model || m.startsWith(model + ":")
        );

        if (modelPulled) {
            statusEl.textContent = `✅ Connected. Model "${model}" is ready.`;
            statusEl.style.color = "#10b981";
        } else if (models.length > 0) {
            statusEl.textContent = `⚠ Ollama running but "${model}" not found. Pull it first.`;
            statusEl.style.color = "#f59e0b";
        } else {
            statusEl.textContent = "⚠ Ollama running but no models pulled yet.";
            statusEl.style.color = "#f59e0b";
        }
    } catch (e) {
        statusEl.textContent = "❌ Cannot reach Ollama — is it running? (ollama serve)";
        statusEl.style.color = "#ef4444";
    }
};

// ── List available models ─────────────────────────────────────────────────────
const listModels = async () => {
    const url = getEl("ollamaUrl").value.trim().replace(/\/$/, "");
    const listEl = getEl("modelList");

    listEl.textContent = "Loading...";

    try {
        const response = await fetch(`${url}${TAGS_PATH}`, {
            signal: AbortSignal.timeout(6000)
        });

        if (!response.ok) {
            listEl.textContent = `Error: ${response.status}`;
            return;
        }

        const data = await response.json();
        const models = (data.models || []).map((m) => m.name);

        if (models.length === 0) {
            listEl.textContent = "No models found. Run: ollama pull llama3.2";
        } else {
            listEl.innerHTML = "<strong>Available models:</strong><br>" +
                models.map((m) => `&nbsp;&nbsp;• ${m}`).join("<br>");
        }
    } catch {
        listEl.textContent = "Cannot reach Ollama.";
    }
};

// ── Wire up ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", restoreOptions);
getEl("save").addEventListener("click", saveOptions);
getEl("test").addEventListener("click", testConnection);
getEl("listModels").addEventListener("click", listModels);
