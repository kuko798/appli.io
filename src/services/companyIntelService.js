/**
 * Company Intel: DuckDuckGo + company_intel/server.py → OpenAI-compatible chat (e.g. pytorch_chat_server).
 */

/** Slightly above company_intel chat timeout (default 360s) so the browser does not abort first. */
const FETCH_TIMEOUT_MS = 420_000;

export function getCompanyIntelBaseUrl() {
    try {
        if (typeof window !== "undefined" && window.location?.port === "5173") {
            const h = window.location.hostname || "";
            if (h === "localhost" || h === "127.0.0.1") {
                return `${window.location.origin}/appli-company-intel`.replace(/\/+$/, "");
            }
        }
    } catch {
        /* ignore */
    }
    return "http://127.0.0.1:8780";
}

export async function fetchCompanyIntel({ company, title, temperature = 0.5, fast = true }) {
    const base = getCompanyIntelBaseUrl();
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
        res = await fetch(`${base}/company-intel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                company: company || "",
                title: title || "a candidate",
                temperature,
                fast
            }),
            signal: ctrl.signal
        });
    } catch (e) {
        if (e?.name === "AbortError") {
            throw new Error(`Request timed out after ${Math.round(FETCH_TIMEOUT_MS / 60000)} minutes. Try a smaller/faster model or raise APPLI_INTEL_CHAT_TIMEOUT_SEC.`);
        }
        throw e;
    } finally {
        clearTimeout(tid);
    }
    const raw = await res.text();
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(raw.slice(0, 240) || `HTTP ${res.status}`);
    }
    if (!res.ok) {
        const detail = data?.detail;
        const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? JSON.stringify(detail) : data?.detail || raw.slice(0, 240);
        throw new Error(msg || `HTTP ${res.status}`);
    }
    const report = (data.report || "").trim();
    if (!report) throw new Error("Empty report from company intel service");
    return report;
}
