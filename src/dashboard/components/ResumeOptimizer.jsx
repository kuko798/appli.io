import React, { useState, useRef, useEffect, startTransition } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import LocalLLM from '../../background/localLLM.js';
import {
    buildReportDataFromCritiqueJson,
    cleanOptimizedOutput,
    enforceCritiqueBulletCoverage,
    formatJdKeywordHintsForPrompt,
    formatSegmentedBlocksForCritiquePrompt,
    llmErrorMessage,
    scoreColor,
    sliceForCritiquePrompt,
    sliceForOptimizePrompt,
    wordCount,
} from '../utils/resumeOptimizerUtils.js';

/**
 * Prefer `chrome.runtime.getURL` when present (absolute worker URL). The web shim returns a relative path,
 * so we fall back to Vite’s bundled `pdf.worker` URL to avoid 404s under /src/dashboard/.
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

const OPEN_SOURCE_REFERENCES = [
    { name: 'Resume Matcher', desc: 'JD keyword alignment, truthful tailoring, anti-AI-buzzword polish patterns', url: 'https://github.com/srbhr/Resume-Matcher' },
    { name: 'HR-Breaker', desc: 'Job-specific optimization, ATS-style checks, anti-hallucination loop', url: 'https://github.com/btseytlin/hr-breaker' },
    { name: 'JadeAI', desc: 'JD match analysis, templates, multi-format resume tooling', url: 'https://github.com/twwch/JadeAI' },
    { name: 'ATSResume', desc: 'ATS-oriented resume structure and scoring mindset', url: 'https://github.com/sauravhathi/atsresume' },
    { name: 'JobHuntr (Ollama agent)', desc: 'End-to-end apply workflows and resume iteration patterns', url: 'https://github.com/lookr-fyi/job-application-bot-by-ollama-ai' },
];

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

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

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
        setProgress(0);
        setElapsedMs(0);
        setView('scanning');
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000);

        const labels = diagnoseSteps;
        let i = 0;
        // Faster step cadence so we reach the LLM call sooner
        const interval = setInterval(() => {
            if (i < labels.length) {
                setScanSteps((prev) => [...prev, labels[i++]]);
                setProgress(Math.round(((i) / (labels.length + 1)) * 70));
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
            } else {
                clearInterval(interval);
                fetchCritique();
            }
        }, 160);
    };

    const fetchCritique = async () => {
        setProgress(72);
        try {
            // Drop contact/education/skills; keep experience + leadership up to RESUME_CRITIQUE_CHAR_LIMIT
            const truncated = sliceForCritiquePrompt(resumeText);
            const { text: resumeForModel, blockCount } = formatSegmentedBlocksForCritiquePrompt(truncated);
            const jdSlice = jobDescription.trim().slice(0, 1200);
            const jdBlock = jdSlice
                ? `\nJob target (flag honest keyword gaps only; never invent facts):\n${jdSlice}\n`
                : '';
            const blockRule =
                blockCount > 1
                    ? `The resume is split into ${blockCount} JOB_BLOCKs (marked with >>>). Your "experiences" array MUST contain exactly ${blockCount} objects — one per JOB_BLOCK, in the same order. Use the [HINT] label in each block header as the role_at_company value. NEVER merge two blocks or skip a block.\n\n`
                    : '';
            // Count bullets across the whole resume to size maxTokens accurately
            const totalBullets = (resumeForModel.match(/^[•\-\*]\s/gm) || []).length || 15;
            // Each bullet in JSON ≈ 120 tokens (original text + rating + critique + 2 suggestions)
            const neededTokens = Math.min(12000, 1400 + totalBullets * 220 + blockCount * 140);

            const prompt = `Resume reviewer. Return ONLY valid JSON, no markdown.

${blockRule}REQUIRED: your "experiences" array must have exactly ${blockCount} objects (one per JOB_BLOCK). Each object's "analysis" array must contain ALL bullets from that block — every single bullet, none skipped.

SCORING (integers only):
- 9-10: concrete outcome + specific scope/metric (strong and credible impact)
- 7-8: clear action + useful specificity, but impact depth is moderate
- 4-6: understandable action, limited scope/outcome detail
- 1-3: generic responsibility language, little to no concrete detail
- Use the full 1-10 scale honestly; do not cluster all bullets at the same score.
- If bullet quality differs, scores must differ.

CRITIQUE RULES:
- Write 10–18 words of specific advice on what would make this bullet stronger
- Do NOT describe why the score is what it is (never write "Contains a metric" or "Has a number")
- Do NOT say "add company name", "add more context", or "add detail" without saying exactly what detail
- Each critique must be different — never repeat the same sentence across bullets

SUGGESTIONS: 2 rewrites per bullet, max 18 words each, using only facts from the bullet. Do not invent new numbers.

role_at_company: use the [HINT] value exactly if provided. Otherwise: title from line 2 (strip trailing "City, ST") + ", " + company from line 1 (strip date range).
${jdBlock}
Resume:
${resumeForModel}

JSON:
{"summary":{"structural_integrity":{"rating":6,"advice":"sentence"},"signal_strength":{"rating":8,"advice":"sentence"},"impact_specificity":{"rating":5,"advice":"sentence"}},"experiences":[{"role_at_company":"Title, Company","analysis":[{"original_bullet":"bullet text","rating":4,"critique":"advice","suggestions":["rewrite1","rewrite2"]}]}],"upgrade_path":["tip1","tip2","tip3"]}`;

            const json = await LocalLLM.generateJSON({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                maxTokens: neededTokens,
            });
            // Yield so the browser can paint; large JSON + huge insights tree can freeze Edge otherwise.
            await new Promise((r) => setTimeout(r, 0));
            const coveredJson = enforceCritiqueBulletCoverage(json, resumeForModel, blockCount);
            const report = buildReportDataFromCritiqueJson(coveredJson);
            if (timerRef.current) clearInterval(timerRef.current);
            startTransition(() => {
                setProgress(100);
                setReportData(report);
                setView('insights');
            });
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
        setScanSteps((prev) => [
            ...prev,
            'Calling your local LLM: full resume rewrites are large; on CPU expect several minutes. The bar completes only when the draft is returned.',
        ]);
        try {
            const resume = sliceForOptimizePrompt(resumeText);
            const jd = jobDescription.trim().slice(0, 3200);
            const system = `You are an ATS-aware resume editor for candidates in ANY profession (clinical, education, sales, skilled trades, logistics, government, nonprofit, creative, engineering, etc.). Output ONLY the rewritten resume as plain text (no JSON, no markdown code fences, no preamble or postscript).

Layout & scanability (recruiters skim in seconds — this matters as much as wording):
- Put ONE blank line between major sections (e.g. after Education before Professional Experience, after Professional Experience before Leadership or Volunteer work).
- Put ONE blank line between each distinct job and each distinct leadership organization. Never run the end of one employer's bullets straight into the next organization's name on the same visual block without a blank line between them.
- Use this repeating shape for every role (experience and leadership): company/org line, then location line, then title line, then date line, then bullets — then blank line before the next role.
- Two different employers are ALWAYS two separate blocks with a blank line between them. Never place Company B's title, dates, or bullets immediately under Company A without that separator.

Employer blocks (most important):
- Professional Experience must have the SAME number of separate job blocks as the source. Each distinct employer or organization in the source gets its own block: company line, then location, job title, date range, then ONLY that role's bullets.
- NEVER merge two employers into one block. NEVER put another organization's role title, city, dates, or bullets under the wrong employer. Example error to avoid: listing "Regional Health System" content under "City School District" when the source lists them as separate jobs.
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

Skills & credentials (any field):
- Preserve the source section structure: may be "Technical Skills", "Skills", "Certifications", "Clinical competencies", "Software", "Languages", etc. Use the same headings the candidate used when sensible.
- For tech resumes, keep Programming: and Tools: (or equivalent) as in the source. For non-tech resumes, keep licenses, EHR systems, equipment, methodologies, or languages exactly as categories make sense — do not force a software-only layout if the source is clinical, retail, or education-focused.
- Merge orphan fragment lines into the most appropriate labeled line above them (e.g. stray tools into Tools:).
- REMOVE any standalone line that is only a comma-separated list of big consumer/tech brand names (e.g. Apple, Google, TikTok, OpenAI, Meta, NVIDIA, Salesforce, Amazon) with no job context — treat as accidental paste/OCR noise, NOT skills, even if it appears in the source.
- If a labeled skills line ends with such brand names after legitimate entries, truncate at the last legitimate skill/tool and delete the trailing brands.
- Do not add new brand names to the skills section that were not in the source as real qualifications.

General:
- Keep section order: header, Education, Professional Experience, then Leadership / Volunteer / Certifications / Skills as in the source.
- Simple punctuation only — no HTML/tables.

Honest JD alignment (patterns per Resume Matcher / srbhr/Resume-Matcher: truthful keyword weaving, not fabrication):
- When a job description is provided: mirror JD phrasing only where the SOURCE RESUME already supports it. Rephrase existing bullets to surface overlap; do NOT add skills, tools, certifications, or metrics absent from the source.
- Prefer clear, direct wording over resume clichés unless the source already uses them (e.g. prefer "led" over "spearheaded", "used" over "leveraged", "helped" over "facilitated").
- Do not use em-dashes; use commas or periods instead.`;

            const tail =
                '\n\nRemember: blank line between every role and every major section; never merge two employers into one block; COPY EVERY SOURCE BULLET as its own "• " line; preserve locations from source; no empty experience/leadership sections; improve wording only; drop junk brand-only skills lines; stay honest to any profession.';
            const jdHints = jd ? formatJdKeywordHintsForPrompt(jd) : '';
            const user = jd
                ? `Job description (honest alignment only; see system rules):\n${jd}${jdHints ? `\n${jdHints}\n` : ''}\n---\n\nSOURCE RESUME: rewrite into optimized plain text:\n${resume}${tail}`
                : `SOURCE RESUME: rewrite for general ATS clarity and scan-friendly structure:\n${resume}${tail}`;

            const out = await LocalLLM.generate({
                system,
                messages: [{ role: 'user', content: user }],
                temperature: 0.2,
                maxTokens: 7200,
            });
            await new Promise((r) => setTimeout(r, 0));
            const cleaned = cleanOptimizedOutput(out);
            if (timerRef.current) clearInterval(timerRef.current);
            startTransition(() => {
                setProgress(100);
                setOptimizedText(cleaned);
                setView('compare');
            });
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
            onKeyDown={e => { if (e.key === 'Escape' && view === 'scanning') e.stopPropagation(); }}
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
                            {fileName
                                ? fileName
                                : 'Any profession - bullet-level resume diagnostics'}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={view !== 'scanning' ? onCancel : undefined}
                        disabled={view === 'scanning'}
                        title={view === 'scanning' ? 'Analysis in progress — please wait' : 'Close'}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #d7e0ec',
                            color: view === 'scanning' ? '#b0b8c8' : '#6a5f7e',
                            padding: '6px 14px',
                            borderRadius: 7,
                            fontSize: 13,
                            cursor: view === 'scanning' ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: view === 'scanning' ? 0.5 : 1,
                        }}
                    >
                        {view === 'scanning' ? 'Running…' : 'Close'}
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
                                            width: `${Math.round(progress)}%`,
                                            background: `linear-gradient(90deg, ${BRAND}, #d56cc7)`,
                                            borderRadius: 100,
                                            transition: 'width 0.3s ease',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                    <span style={{ fontSize: 12, color: '#6f8299' }}>{Math.round(elapsedMs / 1000)}s</span>
                                    <span style={{ fontSize: 12, color: '#6f8299' }}>{Math.round(progress)}%</span>
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
                                        <span style={{ fontSize: 14, color: '#5b708a' }}>
                                            {progress >= 72
                                                ? `Waiting for LLM response… ${Math.round(elapsedMs / 1000)}s`
                                                : 'Working…'}
                                        </span>
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

