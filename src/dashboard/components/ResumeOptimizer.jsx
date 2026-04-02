import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import LocalLLM from '../../background/localLLM.js';

/**
 * Mock chrome.runtime.getURL('assets/...') returns a relative path, which breaks PDF.js
 * on Vite dev (worker 404 under /src/dashboard/). Real extension: full chrome-extension:// URL.
 */
function resolvePdfWorkerSrc() {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
            const raw = chrome.runtime.getURL('assets/pdf.worker.min.js');
            if (raw.startsWith('chrome-extension:') || raw.startsWith('http://') || raw.startsWith('https://')) {
                return raw;
            }
        }
    } catch {
        /* ignore */
    }
    return pdfjsWorkerUrl;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = resolvePdfWorkerSrc();

const BRAND = '#8e5be8';

const scoreColor = (r) => (r >= 8 ? '#10b981' : r >= 5 ? '#f59e0b' : '#f87171');

const OPEN_SOURCE_REFERENCES = [
    { name: 'HR-Breaker', desc: 'Job-specific optimization, ATS-style checks, anti-hallucination loop', url: 'https://github.com/btseytlin/hr-breaker' },
    { name: 'JadeAI', desc: 'JD match analysis, templates, multi-format resume tooling', url: 'https://github.com/twwch/JadeAI' },
    { name: 'ATSResume', desc: 'ATS-oriented resume structure and scoring mindset', url: 'https://github.com/sauravhathi/atsresume' },
    { name: 'JobHuntr (Ollama agent)', desc: 'End-to-end apply workflows and resume iteration patterns', url: 'https://github.com/lookr-fyi/job-application-bot-by-ollama-ai' },
];

function stripCodeFences(text) {
    let t = (text || '').trim();
    t = t.replace(/^```(?:plaintext|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return t;
}

/** Consumer / big-tech names that are not resume skills — models sometimes keep OCR/paste noise. */
const SKILL_JUNK_BRANDS = [
    'Apple',
    'Google',
    'TikTok',
    'OpenAI',
    'Meta',
    'NVIDIA',
    'Salesforce',
    'Amazon',
    'Netflix',
    'Spotify',
];

function countJunkBrandHits(line) {
    let n = 0;
    for (const w of SKILL_JUNK_BRANDS) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(line)) n += 1;
    }
    return n;
}

/** Drop standalone lines that are mostly junk brand names (not Programming:/Tools: rows or bullets). */
function stripConsumerBrandSkillNoise(text) {
    const lines = (text || '').split('\n');
    const out = [];
    for (const line of lines) {
        const t = line.trim();
        if (!t) {
            out.push(line);
            continue;
        }
        if (/^(Programming|Tools)\s*:/i.test(t) || t.startsWith('•')) {
            out.push(line);
            continue;
        }
        const hits = countJunkBrandHits(t);
        if (hits >= 3 && !t.includes(':')) {
            continue;
        }
        out.push(line);
    }
    return out.join('\n');
}

function collapseExcessBlankLines(text) {
    return (text || '')
        .replace(/\n{4,}/g, '\n\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

function cleanOptimizedOutput(raw) {
    let t = stripCodeFences(raw);
    t = stripConsumerBrandSkillNoise(t);
    t = collapseExcessBlankLines(t);
    return t;
}

function wordCount(s) {
    return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

/** Surface FastAPI `detail` from failed LLM responses (status on err from LocalLLM). */
function llmErrorMessage(err) {
    let m = err?.message || 'Request failed';
    const raw = err?.responseText;
    if (raw && typeof raw === 'string') {
        try {
            const j = JSON.parse(raw);
            if (typeof j.detail === 'string') return j.detail;
            if (Array.isArray(j.detail)) {
                const parts = j.detail.map((d) => (typeof d === 'object' && d?.msg ? d.msg : String(d)));
                if (parts.length) return parts.join('; ');
            }
        } catch {
            if (raw.length < 400) m = raw;
        }
    }
    if (err?.status === 500) {
        m = `${m} If the LLM is local, check the terminal running pytorch_chat_server for errors.`;
    }
    return m;
}

export default function ResumeOptimizer({ onCancel }) {
    const [view, setView] = useState('input');
    const [scanMode, setScanMode] = useState('diagnose');
    const [resumeText, setResumeText] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [optimizedText, setOptimizedText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [scanSteps, setScanSteps] = useState([]);
    const [progress, setProgress] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [reportData, setReportData] = useState(null);
    const [showRefs, setShowRefs] = useState(false);
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);

    const diagnoseSteps = [
        'Parsing resume structure…',
        'Identifying experience sections…',
        'Evaluating bullet strength…',
        'Checking measurable impact…',
        'Scoring clarity & keywords…',
        'Generating rewrite suggestions…',
        'Building upgrade roadmap…',
        'Finalizing insights…',
    ];

    const optimizeSteps = [
        'Reading resume + job context…',
        'Mapping honest keyword overlap…',
        'Restructuring for ATS scan…',
        'Tightening action verbs & metrics…',
        'Preserving factual guardrails…',
        'Generating optimized draft…',
    ];

    const parsePDF = async (buf) => {
        const loadingTask = pdfjsLib.getDocument({ data: buf, useSystemFonts: true });
        const pdf = await loadingTask.promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            let lastY = null;
            let pageText = '';
            for (const item of content.items) {
                const y = item.transform?.[5] ?? null;
                if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) pageText += '\n';
                pageText += 'str' in item ? item.str : '';
                if (item.hasEOL) pageText += '\n';
                lastY = y;
            }
            text += `${pageText}\n`;
        }
        return text;
    };

    const handleFile = async (file) => {
        if (!file) return;
        setFileName(file.name);
        setIsParsing(true);
        try {
            const buf = await file.arrayBuffer();
            const lower = file.name.toLowerCase();
            const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
            let text = '';
            if (isPdf) text = await parsePDF(buf);
            else if (lower.endsWith('.docx')) text = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
            else text = await file.text();
            const trimmed = text.trim();
            if (!trimmed || trimmed.length < 10) {
                throw new Error(
                    isPdf
                        ? 'No selectable text in this PDF (often a scanned image). Export as text from Word, or paste the resume below.'
                        : 'File looks empty.'
                );
            }
            setResumeText(text);
        } catch (err) {
            const msg = err?.message || String(err);
            console.error('[ResumeOptimizer] File parse error:', err);
            alert(
                msg.length > 220 ? `${msg.slice(0, 220)}…` : msg || 'Could not read that file. Try DOCX/TXT or paste text below.'
            );
            setFileName('');
        } finally {
            setIsParsing(false);
        }
    };

    const startScan = (mode) => {
        if (!resumeText.trim()) return;
        setScanMode(mode);
        setReportData(null);
        if (mode === 'optimize') setOptimizedText('');
        setScanSteps([]);
        setProgress(5);
        setElapsedMs(0);
        setView('scanning');
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000);

        const labels = mode === 'diagnose' ? diagnoseSteps : optimizeSteps;
        let i = 0;
        const interval = setInterval(() => {
            if (i < labels.length) {
                setScanSteps((prev) => [...prev, labels[i++]]);
                setProgress(Math.min(75, Math.round(((i + 1) / labels.length) * 70)));
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            } else {
                clearInterval(interval);
                setProgress(80);
                if (mode === 'diagnose') fetchCritique();
                else fetchOptimizedResume();
            }
        }, 240);
    };

    const normalizeKeys = (obj) => {
        if (Array.isArray(obj)) return obj.map(normalizeKeys);
        if (obj && typeof obj === 'object') {
            return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), normalizeKeys(v)]));
        }
        return obj;
    };

    const fetchCritique = async () => {
        try {
            const truncated = resumeText.trim().slice(0, 2500);
            const prompt = `Resume reviewer. Return ONLY valid JSON, no markdown.

From the resume, pick the 3 most important work experience roles. For each role pick the 3 strongest/weakest bullets to review.

Scoring: rating 1-10. No metrics=<=6. Weak verbs=<=5. Real metrics=>=7.
Critique: max 15 words. Suggestions: 2 rewrites, max 12 words each, use X%/N+ for numbers.

Resume:
${truncated}

JSON:
{"summary":{"structural_integrity":{"rating":0,"advice":""},"signal_strength":{"rating":0,"advice":""},"tech_arity":{"rating":0,"advice":""}},"experiences":[{"role_at_company":"Role, Company","analysis":[{"original_bullet":"text","rating":0,"critique":"","suggestions":["s1","s2"]}]}],"upgrade_path":["tip1","tip2","tip3"]}`;

            const json = await LocalLLM.generateJSON({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                maxTokens: 1500,
            });
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);

            const raw = normalizeKeys(json);
            const toScore = (v) =>
                v && typeof v === 'object'
                    ? { rating: Number(v.rating) || 0, advice: v.advice || '' }
                    : { rating: 0, advice: '' };
            const summary = raw.summary || {};
            const experiences = (raw.experiences || [])
                .map((exp) => ({
                    role_at_company: exp.role_at_company || 'Experience',
                    analysis: (exp.analysis || [])
                        .map((a) => ({
                            original_bullet: a.original_bullet || '',
                            rating: Number(a.rating) || 0,
                            critique: a.critique || '',
                            suggestions: Array.isArray(a.suggestions) ? a.suggestions.filter(Boolean) : [],
                        }))
                        .filter((a) => a.original_bullet),
                }))
                .filter((exp) => exp.analysis.length > 0);

            setReportData({
                summary: {
                    structural_integrity: toScore(summary.structural_integrity),
                    signal_strength: toScore(summary.signal_strength),
                    tech_arity: toScore(summary.tech_arity),
                },
                experiences,
                upgrade_path: (raw.upgrade_path || []).filter(Boolean),
            });
            setTimeout(() => setView('insights'), 500);
        } catch (err) {
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);
            const detail = llmErrorMessage(err);
            setScanSteps((prev) => [
                ...prev,
                `Error: ${detail.length > 280 ? `${detail.slice(0, 280)}…` : detail}`,
            ]);
        }
    };

    const fetchOptimizedResume = async () => {
        try {
            const resume = resumeText.trim().slice(0, 5600);
            const jd = jobDescription.trim().slice(0, 3200);
            const system = `You are an ATS-aware resume editor. Output ONLY the rewritten resume as plain text (no JSON, no markdown code fences, no preamble or postscript).

Layout & scanability (recruiters skim in seconds — this matters as much as wording):
- Put ONE blank line between major sections (e.g. after Education before Professional Experience, after Professional Experience before Leadership).
- Put ONE blank line between each distinct job and each distinct leadership organization. Never run the end of one employer's bullets straight into the next company's name on the same visual block without a blank line between them.
- Use this repeating shape for every role (experience and leadership): company/org line, then location line, then title line, then date line, then bullets — then blank line before the next role.
- IBM and a different company (e.g. Enterprise Mobility) are ALWAYS two separate blocks with a blank line between them. Never place Enterprise Mobility's title, dates, or bullets immediately under IBM without that separator.

Employer blocks (most important):
- Professional Experience must have the SAME number of separate job blocks as the source. Each distinct employer or organization in the source gets its own block: company line, then location, job title, date range, then ONLY that role's bullets.
- NEVER merge two employers into one block. NEVER put another company's role title, city, dates, or bullets under the wrong company. Example error to avoid: listing "Enterprise Mobility" bullets under "IBM" or inventing a bullet like "Enterprise Mobility internship" under IBM when the source treats them as two entries.
- If the source uses a short header line (e.g. company name only) followed by another line for title/dates, preserve that logical pairing; do not reorder so bullets attach to the wrong role.

Locations:
- Copy City, State/region lines from the source exactly for each org. Do not invent or change state abbreviations (e.g. if the source says Saint Louis, MO, keep MO; never output Saint Louis, WI unless the source literally says WI).

Bullets (critical — incomplete output is wrong):
- Every bullet that appears under a role in the SOURCE must appear in the OUTPUT under that same role as its own line starting with the character "• " (bullet + space). Do NOT use plain hyphens or asterisks for experience bullets. Do NOT merge bullets into one long sentence or paragraph.
- Do NOT output a job or leadership entry with only company/title/dates and no bullets if the source had bullets there. Skipping bullets to save length is forbidden.
- Same count per role as the source (rephrase inside the bullet only: clearer phrasing, stronger verbs, fix grammar). Do NOT add new achievements, metrics, tools, or team sizes that are not already implied by that bullet's source text.
- Do not combine two source bullets into one line. Do not summarize multiple bullets into fewer lines.

Anti-fabrication:
- Every number, percentage, timeframe, technology, and project name in the output must trace to the same role's source bullets. Do not invent or inflate outcomes.
- Minor grammar fixes (e.g. "school boards" → "school board") are OK if the source clearly meant singular.

Technical Skills:
- Keep Programming: and Tools: (or equivalent) as in the source. List legitimate languages/frameworks/tools only. If a fragment line belongs with Tools (e.g. "DevOps, Flask, PostgreSQL"), merge it into the Tools: line — do not leave a stray third line of tools.
- REMOVE any standalone line that is only a comma-separated list of big consumer/tech brand names (e.g. Apple, Google, TikTok, OpenAI, Meta, NVIDIA, Salesforce, Amazon) with no job context — treat as accidental paste/OCR noise, NOT skills, even if it appears in the source.
- If the Tools: line ends with such brand names after real tools, truncate at the last legitimate tool and delete the trailing brands.
- Do not add new brand names to the skills section that were not in the source as real tools/languages.

General:
- Keep section order: header, Education, Professional Experience, Leadership, Technical Skills (or whatever the source uses).
- Simple punctuation only — no HTML/tables.`;

            const tail =
                '\n\nRemember: blank line between every role and every major section; IBM ≠ next company — separate blocks; COPY EVERY SOURCE BULLET as its own "• " line; preserve locations from source; no empty experience/leadership sections; improve wording only; drop junk brand-only skills lines.';
            const user = jd
                ? `Job description (use only to mirror real skills/experience; do not add false keywords):\n${jd}\n\n---\n\nSOURCE RESUME — rewrite into optimized plain text:\n${resume}${tail}`
                : `SOURCE RESUME — rewrite for general ATS clarity and scan-friendly structure:\n${resume}${tail}`;

            const out = await LocalLLM.generate({
                system,
                messages: [{ role: 'user', content: user }],
                temperature: 0.2,
                maxTokens: 3200,
            });
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);
            setOptimizedText(cleanOptimizedOutput(out));
            setTimeout(() => setView('compare'), 500);
        } catch (err) {
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);
            const detail = llmErrorMessage(err);
            setScanSteps((prev) => [
                ...prev,
                `Error: ${detail.length > 280 ? `${detail.slice(0, 280)}…` : detail}`,
            ]);
        }
    };

    const copyText = async (label, text) => {
        try {
            await navigator.clipboard.writeText(text);
            alert(`${label} copied to clipboard.`);
        } catch {
            alert('Could not copy — select text manually.');
        }
    };

    const resetAll = () => {
        setView('input');
        setReportData(null);
        setOptimizedText('');
        setProgress(0);
        setScanSteps([]);
        setResumeText('');
        setJobDescription('');
        setFileName('');
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2000,
                background: 'rgba(244,247,251,0.76)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    width: view === 'compare' ? Math.min(1100, typeof window !== 'undefined' ? window.innerWidth - 48 : 1100) : 860,
                    maxWidth: '96vw',
                    maxHeight: '90vh',
                    background: '#ffffff',
                    border: '1px solid #d7e0ec',
                    borderRadius: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(15,23,40,0.14)',
                }}
            >
                <div
                    style={{
                        padding: '18px 24px',
                        borderBottom: '1px solid #d7e0ec',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                    }}
                >
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f1728' }}>Resume optimizer</div>
                        <div style={{ fontSize: 12, color: '#6f8299', marginTop: 1 }}>
                            {fileName ? fileName : 'Insights, JD-aware rewrite, and side-by-side compare'}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #d7e0ec',
                            color: '#6a5f7e',
                            padding: '6px 14px',
                            borderRadius: 7,
                            fontSize: 13,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                        }}
                    >
                        Close
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
                    {view === 'input' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    handleFile(e.dataTransfer.files[0]);
                                }}
                                style={{
                                    border: `2px dashed ${isDragging ? BRAND : '#c5d3e6'}`,
                                    borderRadius: 12,
                                    padding: '28px 24px',
                                    textAlign: 'center',
                                    transition: 'border-color 0.2s',
                                    background: isDragging ? `${BRAND}10` : '#f8fbff',
                                }}
                            >
                                <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1728', marginBottom: 6 }}>
                                    {isParsing ? 'Reading file…' : 'Drop your resume here'}
                                </div>
                                <div style={{ fontSize: 13, color: '#6f8299', marginBottom: 16 }}>PDF, DOCX, or TXT</div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleFile(e.target.files[0])}
                                    accept=".pdf,.docx,.txt"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={isParsing}
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid #d7e0ec',
                                        color: '#4b6078',
                                        padding: '8px 20px',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        cursor: isParsing ? 'not-allowed' : 'pointer',
                                        fontFamily: 'inherit',
                                        opacity: isParsing ? 0.5 : 1,
                                    }}
                                >
                                    {isParsing ? 'Reading…' : fileName ? 'Change file' : 'Choose file'}
                                </button>
                            </div>

                            <div style={{ textAlign: 'center', fontSize: 13, color: '#6f8299' }}>
                                or paste resume text
                            </div>
                            <textarea
                                value={resumeText}
                                onChange={(e) => setResumeText(e.target.value)}
                                placeholder="Paste your resume…"
                                style={{
                                    minHeight: 160,
                                    background: '#ffffff',
                                    border: '1px solid #d7e0ec',
                                    borderRadius: 10,
                                    color: '#0f1728',
                                    padding: '14px',
                                    fontSize: 14,
                                    lineHeight: 1.55,
                                    resize: 'vertical',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                }}
                            />

                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1728', marginBottom: 8 }}>
                                    Job description (optional, for targeted optimization)
                                </div>
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste a posting or bullet list of requirements — used only to align honest wording and keywords."
                                    style={{
                                        minHeight: 100,
                                        background: '#fafbfc',
                                        border: '1px solid #d7e0ec',
                                        borderRadius: 10,
                                        color: '#0f1728',
                                        padding: '12px',
                                        fontSize: 13,
                                        lineHeight: 1.55,
                                        resize: 'vertical',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => startScan('diagnose')}
                                    disabled={!resumeText.trim() || isParsing}
                                    style={{
                                        flex: '1 1 200px',
                                        background: '#ffffff',
                                        color: '#4b6078',
                                        border: `1px solid ${BRAND}50`,
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: !resumeText.trim() || isParsing ? 'not-allowed' : 'pointer',
                                        fontFamily: 'inherit',
                                        opacity: !resumeText.trim() || isParsing ? 0.5 : 1,
                                    }}
                                >
                                    Run diagnostic
                                </button>
                                <button
                                    type="button"
                                    onClick={() => startScan('optimize')}
                                    disabled={!resumeText.trim() || isParsing}
                                    style={{
                                        flex: '1 1 200px',
                                        background: BRAND,
                                        color: '#fff',
                                        border: 'none',
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: !resumeText.trim() || isParsing ? 'not-allowed' : 'pointer',
                                        fontFamily: 'inherit',
                                        opacity: !resumeText.trim() || isParsing ? 0.5 : 1,
                                    }}
                                >
                                    Generate optimized resume
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowRefs((v) => !v)}
                                style={{
                                    alignSelf: 'flex-start',
                                    background: 'none',
                                    border: 'none',
                                    color: '#6f8299',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontFamily: 'inherit',
                                    padding: 0,
                                }}
                            >
                                {showRefs ? 'Hide' : 'Show'} open-source ideas we drew from
                            </button>
                            {showRefs && (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: '#5b708a',
                                        lineHeight: 1.65,
                                        padding: 14,
                                        background: '#f8fafc',
                                        borderRadius: 10,
                                        border: '1px solid #e2e8f0',
                                    }}
                                >
                                    {OPEN_SOURCE_REFERENCES.map((r) => (
                                        <div key={r.url} style={{ marginBottom: 10 }}>
                                            <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: BRAND, fontWeight: 600 }}>
                                                {r.name}
                                            </a>
                                            {' — '}
                                            {r.desc}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'scanning' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ height: 6, background: '#d7e0ec', borderRadius: 100, overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${progress}%`,
                                            background: `linear-gradient(90deg, ${BRAND}, #d56cc7)`,
                                            borderRadius: 100,
                                            transition: 'width 0.3s ease',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                    <span style={{ fontSize: 12, color: '#6f8299' }}>{Math.round(elapsedMs / 1000)}s</span>
                                    <span style={{ fontSize: 12, color: '#6f8299' }}>{progress}%</span>
                                </div>
                            </div>
                            <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {scanSteps.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div
                                            style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: '50%',
                                                flexShrink: 0,
                                                background: '#10b98120',
                                                border: '1px solid #10b98150',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 11,
                                                color: '#10b981',
                                            }}
                                        >
                                            ✓
                                        </div>
                                        <span style={{ fontSize: 14, color: '#4b6078' }}>{s}</span>
                                    </div>
                                ))}
                                {progress < 100 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div
                                            style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: '50%',
                                                flexShrink: 0,
                                                border: `2px solid ${BRAND}`,
                                                borderTopColor: 'transparent',
                                                animation: 'spin 0.8s linear infinite',
                                            }}
                                        />
                                        <span style={{ fontSize: 14, color: '#5b708a' }}>Working…</span>
                                    </div>
                                )}
                                {scanSteps.some((s) => s.startsWith('Error:')) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setView('input');
                                            setProgress(0);
                                        }}
                                        style={{
                                            marginTop: 16,
                                            background: '#ffffff',
                                            border: '1px solid #d7e0ec',
                                            color: '#4b6078',
                                            padding: '10px 24px',
                                            borderRadius: 8,
                                            fontSize: 13,
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            alignSelf: 'flex-start',
                                        }}
                                    >
                                        Try again
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'insights' && reportData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                                {Object.entries(reportData.summary).map(([key, data]) => (
                                    <div
                                        key={key}
                                        style={{
                                            background: '#f8fbff',
                                            border: '1px solid #d7e0ec',
                                            borderRadius: 12,
                                            padding: '16px 14px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                marginBottom: 8,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: '#6f8299',
                                                    textTransform: 'capitalize',
                                                }}
                                            >
                                                {key.replace(/_/g, ' ')}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: scoreColor(data.rating),
                                                    background: `${scoreColor(data.rating)}18`,
                                                    border: `1px solid ${scoreColor(data.rating)}40`,
                                                    padding: '2px 8px',
                                                    borderRadius: 6,
                                                }}
                                            >
                                                {data.rating}/10
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.55, margin: 0 }}>{data.advice}</p>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1728', marginBottom: 14 }}>
                                    Bullet-level feedback
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    {reportData.experiences.map((exp, xi) => (
                                        <div key={xi}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#7a45c7', marginBottom: 10 }}>
                                                {exp.role_at_company}
                                            </div>
                                            {exp.analysis.map((bullet, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        background: '#f8fbff',
                                                        border: '1px solid #d7e0ec',
                                                        borderRadius: 10,
                                                        padding: '16px 18px',
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                                                        <div
                                                            style={{
                                                                width: 34,
                                                                height: 34,
                                                                borderRadius: 8,
                                                                flexShrink: 0,
                                                                border: `2px solid ${scoreColor(bullet.rating)}`,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: 13,
                                                                fontWeight: 800,
                                                                color: scoreColor(bullet.rating),
                                                            }}
                                                        >
                                                            {bullet.rating}
                                                        </div>
                                                        <p
                                                            style={{
                                                                fontSize: 14,
                                                                color: '#4b6078',
                                                                fontStyle: 'italic',
                                                                lineHeight: 1.55,
                                                                margin: 0,
                                                                flex: 1,
                                                            }}
                                                        >
                                                            &ldquo;{bullet.original_bullet}&rdquo;
                                                        </p>
                                                    </div>
                                                    <p style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.55, marginBottom: 10 }}>
                                                        {bullet.critique}
                                                    </p>
                                                    {bullet.suggestions.length > 0 && (
                                                        <div
                                                            style={{
                                                                background: `${BRAND}0d`,
                                                                border: `1px solid ${BRAND}30`,
                                                                borderRadius: 8,
                                                                padding: '10px 12px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 6,
                                                            }}
                                                        >
                                                            {bullet.suggestions.map((s, si) => (
                                                                <div key={si} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                                    <span
                                                                        style={{
                                                                            fontSize: 11,
                                                                            color: BRAND,
                                                                            fontWeight: 700,
                                                                            marginTop: 2,
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        Try
                                                                    </span>
                                                                    <span style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.5 }}>{s}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {reportData.upgrade_path.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1728', marginBottom: 12 }}>Top improvements</div>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                            gap: 10,
                                        }}
                                    >
                                        {reportData.upgrade_path.map((tip, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    background: '#f8fbff',
                                                    borderLeft: `3px solid ${BRAND}`,
                                                    borderRadius: '0 10px 10px 0',
                                                    padding: '12px 14px',
                                                    display: 'flex',
                                                    gap: 10,
                                                }}
                                            >
                                                <span style={{ fontSize: 11, fontWeight: 800, color: BRAND, flexShrink: 0 }}>{i + 1}</span>
                                                <span style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.5 }}>{tip}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 10,
                                    paddingTop: 12,
                                    borderTop: '1px solid #d7e0ec',
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => startScan('optimize')}
                                    style={{
                                        flex: '1 1 180px',
                                        padding: '11px',
                                        background: BRAND,
                                        border: 'none',
                                        color: '#fff',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    Generate optimized resume
                                </button>
                                {optimizedText && (
                                    <button
                                        type="button"
                                        onClick={() => setView('compare')}
                                        style={{
                                            flex: '1 1 140px',
                                            padding: '11px',
                                            background: '#ffffff',
                                            border: '1px solid #d7e0ec',
                                            color: '#4b6078',
                                            borderRadius: 8,
                                            fontSize: 13,
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        Compare versions
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setView('input');
                                        setReportData(null);
                                        setProgress(0);
                                        setScanSteps([]);
                                    }}
                                    style={{
                                        flex: '1 1 120px',
                                        padding: '11px',
                                        background: '#ffffff',
                                        border: '1px solid #d7e0ec',
                                        color: '#4b6078',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    Edit resume
                                </button>
                            </div>
                        </div>
                    )}

                    {view === 'compare' && optimizedText && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ fontSize: 13, color: '#5b708a', lineHeight: 1.55 }}>
                                Side-by-side view: original source vs ATS-oriented rewrite. The model is instructed not to fabricate facts
                                (similar to anti-hallucination patterns in tools like{' '}
                                <a href="https://github.com/btseytlin/hr-breaker" target="_blank" rel="noopener noreferrer" style={{ color: BRAND }}>
                                    HR-Breaker
                                </a>
                                ). Always verify dates, titles, and metrics before sending.
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#6f8299' }}>
                                <span>
                                    Original: ~{wordCount(resumeText)} words · Optimized: ~{wordCount(optimizedText)} words
                                </span>
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 14,
                                    minHeight: 320,
                                }}
                            >
                                {['Original', 'Optimized'].map((label, idx) => {
                                    const body = idx === 0 ? resumeText : optimizedText;
                                    return (
                                        <div
                                            key={label}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                border: '1px solid #d7e0ec',
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                                minHeight: 280,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    padding: '10px 14px',
                                                    background: idx === 1 ? `${BRAND}12` : '#f1f5f9',
                                                    borderBottom: '1px solid #d7e0ec',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                }}
                                            >
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1728' }}>{label}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => copyText(label, body)}
                                                    style={{
                                                        fontSize: 12,
                                                        padding: '4px 10px',
                                                        borderRadius: 6,
                                                        border: '1px solid #d7e0ec',
                                                        background: '#fff',
                                                        cursor: 'pointer',
                                                        fontFamily: 'inherit',
                                                        color: '#4b6078',
                                                    }}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <pre
                                                style={{
                                                    margin: 0,
                                                    padding: 14,
                                                    fontSize: 12,
                                                    lineHeight: 1.5,
                                                    color: '#334155',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    flex: 1,
                                                    overflow: 'auto',
                                                    maxHeight: '48vh',
                                                    fontFamily: 'ui-monospace, Consolas, monospace',
                                                }}
                                            >
                                                {body}
                                            </pre>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (reportData) setView('insights');
                                        else setView('input');
                                    }}
                                    style={{
                                        padding: '11px 18px',
                                        background: '#ffffff',
                                        border: '1px solid #d7e0ec',
                                        color: '#4b6078',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {reportData ? 'Back to insights' : 'Back to editor'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => startScan('optimize')}
                                    style={{
                                        padding: '11px 18px',
                                        background: '#ffffff',
                                        border: `1px solid ${BRAND}`,
                                        color: BRAND,
                                        borderRadius: 8,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    Regenerate optimized
                                </button>
                                <button
                                    type="button"
                                    onClick={resetAll}
                                    style={{
                                        padding: '11px 18px',
                                        background: '#ffffff',
                                        border: '1px solid #d7e0ec',
                                        color: '#64748b',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    Start over
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
