const MODELS_PATH = "/v1/models";
const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_MODEL = "Qwen/Qwen2.5-1.5B-Instruct";
const DEFAULT_PYTHON_CLASSIFIER = "http://127.0.0.1:8765";

const getEl = (id) => document.getElementById(id);

const buildHeaders = (apiKey, requestUrl = "") => {
    const headers = {};
    if (/ngrok/i.test(String(requestUrl))) {
        headers["ngrok-skip-browser-warning"] = "true";
    }
    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
};

const restoreOptions = () => {
    chrome.storage.sync.get(
        {
            ollamaUrl: DEFAULT_BASE_URL,
            ollamaModel: DEFAULT_MODEL,
            llmApiKey: "",
            pythonClassifierUrl: DEFAULT_PYTHON_CLASSIFIER
        },
        (items) => {
            getEl("ollamaUrl").value = items.ollamaUrl;
            getEl("ollamaModel").value = items.ollamaModel;
            getEl("llmApiKey").value = items.llmApiKey || "";
            getEl("pythonClassifierUrl").value = items.pythonClassifierUrl || DEFAULT_PYTHON_CLASSIFIER;
        }
    );
};

const saveOptions = () => {
    const ollamaUrl = getEl("ollamaUrl").value.trim().replace(/\/$/, "");
    const ollamaModel = getEl("ollamaModel").value.trim();
    const llmApiKey = getEl("llmApiKey").value.trim();
    const pythonClassifierUrl = getEl("pythonClassifierUrl").value.trim().replace(/\/$/, "");

    chrome.storage.sync.set({ ollamaUrl, ollamaModel, llmApiKey, pythonClassifierUrl }, () => {
        const statusEl = getEl("status");
        statusEl.textContent = "Settings saved.";
        setTimeout(() => { statusEl.textContent = ""; }, 3000);
    });
};

const testConnection = async () => {
    const url = getEl("ollamaUrl").value.trim().replace(/\/$/, "");
    const model = getEl("ollamaModel").value.trim();
    const llmApiKey = getEl("llmApiKey").value.trim();
    const statusEl = getEl("connectionStatus");

    statusEl.textContent = "Connecting to local/provider endpoint...";
    statusEl.style.color = "#6b7280";

    try {
        const modelsUrl = `${url}${MODELS_PATH}`;
        const response = await fetch(modelsUrl, {
            headers: buildHeaders(llmApiKey, modelsUrl),
            signal: AbortSignal.timeout(6000)
        });

        if (!response.ok) {
            statusEl.textContent = `Connection failed (${response.status}).`;
            statusEl.style.color = "#ef4444";
            return;
        }

        const data = await response.json();
        const models = (data.data || []).map((item) => item.id);
        const modelFound = models.some((item) => item === model || item.includes(model));

        if (modelFound) {
            statusEl.textContent = `Connected. Model "${model}" is available.`;
            statusEl.style.color = "#10b981";
        } else if (models.length > 0) {
            statusEl.textContent = `Connected, but "${model}" was not listed. Available: ${models.join(", ")}`;
            statusEl.style.color = "#f59e0b";
        } else {
            statusEl.textContent = "Connected, but no models were listed.";
            statusEl.style.color = "#f59e0b";
        }
    } catch {
        statusEl.textContent = "Cannot reach the configured provider.";
        statusEl.style.color = "#ef4444";
    }
};

const listModels = async () => {
    const url = getEl("ollamaUrl").value.trim().replace(/\/$/, "");
    const llmApiKey = getEl("llmApiKey").value.trim();
    const listEl = getEl("modelList");

    listEl.textContent = "Loading...";

    try {
        const modelsUrl = `${url}${MODELS_PATH}`;
        const response = await fetch(modelsUrl, {
            headers: buildHeaders(llmApiKey, modelsUrl),
            signal: AbortSignal.timeout(6000)
        });

        if (!response.ok) {
            listEl.textContent = `Error: ${response.status}`;
            return;
        }

        const data = await response.json();
        const models = (data.data || []).map((item) => item.id);

        if (models.length === 0) {
            listEl.textContent = "No models reported by the provider.";
        } else {
            listEl.innerHTML = "<strong>Available models:</strong><br>" +
                models.map((item) => `&nbsp;&nbsp;- ${item}`).join("<br>");
        }
    } catch {
        listEl.textContent = "Cannot reach the configured provider.";
    }
};

const testPythonService = async () => {
    const base = getEl("pythonClassifierUrl").value.trim().replace(/\/$/, "");
    const el = getEl("pythonStatus");
    if (!base) {
        el.textContent = "Enter a base URL (e.g. http://127.0.0.1:8765)";
        el.style.color = "#ef4444";
        return;
    }
    el.textContent = "Connecting…";
    el.style.color = "#6b7280";
    try {
        const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) {
            el.textContent = `Failed (${res.status})`;
            el.style.color = "#ef4444";
            return;
        }
        const data = await res.json().catch(() => ({}));
        el.textContent = `OK — ${JSON.stringify(data)}`;
        el.style.color = "#10b981";
    } catch {
        el.textContent = "Cannot reach Python service. Is python service.py running?";
        el.style.color = "#ef4444";
    }
};

document.addEventListener("DOMContentLoaded", restoreOptions);
getEl("save").addEventListener("click", saveOptions);
getEl("test").addEventListener("click", testConnection);
getEl("listModels").addEventListener("click", listModels);
getEl("testPython").addEventListener("click", testPythonService);
