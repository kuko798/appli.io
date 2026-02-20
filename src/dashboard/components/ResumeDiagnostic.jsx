import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import LocalLLM from '../../background/localLLM.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/pdf.worker.min.js');

const ResumeDiagnostic = ({ onCancel }) => {
    const [view, setView] = useState('INPUT');
    const [resumeText, setResumeText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [scanSteps, setScanSteps] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);

    const steps = [
        "BOOTING_ARMOR_DIAGNOSTIC...",
        "STABILIZING_X-RAY_FIELD...",
        "DECRYPTING_FILE_MATRIX...",
        "UPLOADING_RESUME_DATA...",
        "SCANNING_TECHNICAL_MATRIX...",
        "ANALYZING_CORE_ENGINE_SKILLS...",
        "EVALUATING_SIGNAL_DENSITY...",
        "DETECTING_STRUCTURAL_GLITCHES...",
        "GENERATING_GRANULAR_FEEDBACK_MAP...",
        "FINALIZING_OPTIMIZATION_PATH..."
    ];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [scanSteps]);

    const parsePDF = async (arrayBuffer) => {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + "\n";
        }
        return fullText;
    };

    const parseWord = async (arrayBuffer) => {
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    };

    const handleFile = async (file) => {
        if (!file) return;
        setFileName(file.name);
        setIsParsing(true);
        setView('INPUT');
        setReportData(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            let text = "";

            if (file.type === "application/pdf") {
                text = await parsePDF(arrayBuffer);
            } else if (file.name.endsWith('.docx')) {
                text = await parseWord(arrayBuffer);
            } else {
                text = await file.text();
            }

            if (!text || text.trim().length < 10) {
                throw new Error("EMPTY_DATA_DETECTED");
            }

            setResumeText(text);
        } catch (e) {
            alert("[CRITICAL_ERROR] FILE_PARSE_FAILED");
            setFileName('');
        } finally {
            setIsParsing(false);
        }
    };

    const runAnalysis = async () => {
        if (!resumeText.trim()) return;
        setReportData(null);
        setScanSteps(["INITIATING_ARMOR_SCAN...", `TARGET: ${fileName || "MANUAL_INPUT"}`]);
        setElapsedMs(0);
        setProgress(5);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000);
        setView('SCANNING');

        let i = 0;
        const interval = setInterval(() => {
            if (i < steps.length) {
                setScanSteps(prev => [...prev, steps[i++]]);
                setProgress(Math.min(75, Math.round(((i + 1) / steps.length) * 70)));
            } else {
                clearInterval(interval);
                setProgress(80);
                fetchCritique();
            }
        }, 210);
    };

    const normalizeKeys = (obj) => {
        if (Array.isArray(obj)) return obj.map(normalizeKeys);
        if (obj && typeof obj === 'object') {
            return Object.fromEntries(
                Object.entries(obj).map(([k, v]) => [k.toLowerCase(), normalizeKeys(v)])
            );
        }
        return obj;
    };

    const extractBullets = (text) => {
        const bullets = [];
        if (!text) return bullets;

        // Normalize common inline separators to newlines
        const normalized = text
            .replace(/\s*[•·●◦]\s*/g, "\n")
            .replace(/\s+-\s+/g, "\n");

        // Pass 1: lines (keep short lines too)
        const lines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (/^[-*•·●◦]/.test(line)) {
                bullets.push(line.replace(/^[-*•·●◦]\s*/, '').trim());
                continue;
            }
            if (line.length >= 8) bullets.push(line);
        }

        // Pass 2: sentence split if still few bullets
        if (bullets.length < 3) {
            const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
            sentences.map(s => s.trim()).filter(s => s.length >= 8).forEach(s => bullets.push(s));
        }

        // Fallback: grab top 3 longest chunks so we never return empty
        if (bullets.length === 0) {
            const chunks = text.split(/\s{2,}/).filter(Boolean);
            chunks.sort((a, b) => b.length - a.length);
            bullets.push(...chunks.slice(0, 3));
        }

        return Array.from(new Set(bullets)).slice(0, 50);
    };

    const fetchCritique = async () => {
        try {
            setScanSteps(prev => [
                ...prev,
                "LINK_TYPE: LOCAL_LLM_CORE",
                "ROUTING_TO_OLLAMA_GATEWAY..."
            ]);
            setProgress(85);

            const bullets = extractBullets(resumeText);
            const MAX_BULLETS = 12;
            const limitedBullets = bullets.slice(0, MAX_BULLETS);

            setScanSteps(prev => [...prev, `[DEBUG] Bullets detected: ${bullets.length}${bullets.length > MAX_BULLETS ? ` (truncated to ${MAX_BULLETS})` : ""}`]);
            console.log("[ResumeDiagnostic] text_len:", resumeText.length);
            console.log("[ResumeDiagnostic] bullet_count:", bullets.length, "first_bullets:", bullets.slice(0, 5));
            if (limitedBullets.length === 0) {
                const fallback = resumeText.trim();
                if (fallback.length === 0) {
                    setScanSteps(prev => [...prev, "[WARN] Resume text empty after parse; aborting."]);
                    return;
                }
                setScanSteps(prev => [...prev, "[WARN] No bullets parsed; falling back to full text as single item."]);
                limitedBullets.push(fallback.slice(0, 1200));
            }
            const bulletList = limitedBullets.map((b, i) => `${i + 1}. ${b}`).join("\n");

            const prompt = `You are an expert technical resume reviewer. Return ONLY valid JSON. No markdown, no extra text.

You must rate EVERY bullet provided below. For each bullet index N in the list, include an entry in experiences[0].analysis[N] with matching original_bullet text.

Scoring rules:
- rating is integer 1-10
- If no metrics present => rating <= 6
- Weak verbs (helped, assisted, worked on) => rating <= 5
- Real metrics => rating >= 7
- Never invent numbers; use placeholders X%, N+, <metric> when suggesting
- Keep critiques under 30 words; suggestions under 18 words

Bullet list (keep order):
${bulletList}

Return JSON exactly like:
{
  "summary": {
    "structural_integrity": { "rating": 0, "advice": "" },
    "signal_strength": { "rating": 0, "advice": "" },
    "tech_arity": { "rating": 0, "advice": "" }
  },
  "experiences": [
    {
      "role_at_company": "Resume",
      "analysis": [
        { "original_bullet": "1. <text>", "rating": 0, "critique": "", "suggestions": ["", ""] }
      ]
    }
  ],
  "upgrade_path": ["", "", ""]
}`;

            setScanSteps(prev => [...prev, "INITIATING_CORE_INFERENCE..."]);

            // Debug logging for LLM interaction
            console.log("[ResumeDiagnostic] bullet_count:", bullets.length, "first_bullets:", bullets.slice(0, 5));
            console.log("[ResumeDiagnostic] prompt_preview:", prompt.slice(0, 500));

            const jsonResponse = await LocalLLM.generateJSON({
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                maxTokens: 1200
            });
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);

            console.log("[ResumeDiagnostic] raw_llm_response:", jsonResponse);
            console.log("[ResumeDiagnostic] parsed_llm_response:", JSON.stringify(jsonResponse).slice(0, 500));

            const raw = normalizeKeys(jsonResponse);

            const toScoreObj = (val) => {
                if (val && typeof val === 'object') return { rating: Number(val.rating) || 0, advice: val.advice || '' };
                if (typeof val === 'number') return { rating: val, advice: '' };
                return { rating: 0, advice: '' };
            };
            const summary = raw.summary || {};

            const analysis = ((raw.experiences && raw.experiences[0]?.analysis) || []).map((a) => ({
                original_bullet: a.original_bullet || "",
                rating: Number(a.rating) || 0,
                critique: a.critique || "",
                suggestions: Array.isArray(a.suggestions) ? a.suggestions.filter(Boolean) : []
            }));

            const filledAnalysis = limitedBullets.map((b, idx) => {
                const existing = analysis[idx];
                if (existing) {
                    return {
                        original_bullet: existing.original_bullet || `${idx + 1}. ${b}`,
                        rating: Number(existing.rating) || 0,
                        critique: existing.critique || "",
                        suggestions: existing.suggestions.length ? existing.suggestions : ["Add metric (X%) with outcome", "State tools/stack used"]
                    };
                }
                return {
                    original_bullet: `${idx + 1}. ${b}`,
                    rating: 0,
                    critique: "Model omitted this bullet. Manually assess.",
                    suggestions: ["Add action + metric placeholder", "State tools/stack used"]
                };
            });

            const normalized = {
                summary: {
                    structural_integrity: toScoreObj(summary.structural_integrity),
                    signal_strength: toScoreObj(summary.signal_strength),
                    tech_arity: toScoreObj(summary.tech_arity)
                },
                experiences: [{
                    role_at_company: (raw.experiences && raw.experiences[0]?.role_at_company) || "Resume",
                    analysis: filledAnalysis
                }],
                upgrade_path: (raw.upgrade_path || []).filter(Boolean)
            };
            setReportData(normalized);
            setScanSteps(prev => [...prev, "SCAN_COMPLETE. DATA_STABILIZED."]);
            setTimeout(() => setView('REPORT'), 1000);

        } catch (error) {
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);
            setScanSteps(prev => [
                ...prev,
                `[CRITICAL_FAILURE] ${error?.message?.toUpperCase()}`,
                error?.rawText ? `RAW_JSON: ${error.rawText.substring(0, 200)}` : null,
                "ADVICE: Ensure Ollama is running (ollama serve)"
            ].filter(Boolean));
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <div style={styles.titleGroup}>
                        <div style={styles.glitchBox}>ARMOR_DIAGNOSTIC</div>
                        <span style={styles.status}>// {fileName ? `FILE_LOCKED: ${fileName.toUpperCase()}` : 'WAITING_FOR_DATA'}</span>
                    </div>
                    <button onClick={onCancel} style={styles.closeBtn}>CLOSE_MODULE</button>
                </div>

                <div style={styles.content}>
                    {view === 'INPUT' && (
                        <div style={styles.dropZone} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}>
                            <div style={styles.uploadHUD}>
                                <div style={styles.instruction}>{isParsing ? 'PARSING_DATA...' : 'DROP_ARMOR_FILE_HERE [.PDF, .DOCX, .TXT]'}</div>
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} accept=".pdf,.docx,.txt" />
                                <button onClick={() => fileInputRef.current.click()} style={{ ...styles.uploadBtn, opacity: isParsing ? 0.5 : 1 }} disabled={isParsing}>{isParsing ? 'WORKING...' : fileName ? 'CHANGE_FILE' : 'LOAD_EXTERNAL_DATA'}</button>
                            </div>
                            <div style={styles.divider}>OR_PASTE_DATA_MANUALLY</div>
                            <textarea style={styles.textarea} placeholder="PASTE_RESUME_TEXT_STREAM..." value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
                            <button onClick={runAnalysis} style={{ ...styles.analyzeBtn, opacity: (resumeText && !isParsing) ? 1 : 0.5 }} disabled={!resumeText || isParsing}>
                                INITIATE_SCAN {fileName ? `[${fileName.toUpperCase()}]` : ''}
                            </button>
                        </div>
                    )}

                    {view === 'SCANNING' && (
                        <div style={styles.scanSection}>
                            <div style={styles.progressBarWrap}>
                                <div style={{ ...styles.progressFill, width: `${Math.min(progress, 100)}%` }} />
                                <div style={styles.progressLabel}>
                                    <span>Processing…</span>
                                    <span>{Math.round(progress)}%</span>
                                    <span>{Math.floor(elapsedMs / 1000)}s elapsed</span>
                                </div>
                            </div>
                            <div style={styles.logContainer}>
                                <div style={styles.logHeader}>[DIAGNOSTIC_TERMINAL]</div>
                                <div style={styles.logBody} ref={scrollRef}>
                                    {scanSteps.map((step, i) => (
                                        <div key={i} style={styles.logStep}><span style={styles.prompt}>[SCAN]</span> {step}</div>
                                    ))}
                                    {(!reportData && !scanSteps.some(s => s && s.includes('ERROR'))) && <div style={styles.cursor}>_</div>}
                                </div>
                            </div>
                            {scanSteps.some(s => s && s.includes('ERROR')) && (
                                <button onClick={() => setView('INPUT')} style={styles.retryBtn}>RESET_TERMINAL_AND_RETRY</button>
                            )}
                        </div>
                    )}

                    {view === 'REPORT' && reportData && (
                        <div style={styles.reportSection}>
                            <div style={styles.reportHeaderRow}>
                                <div style={styles.reportTitle}>[ARMOR_DIAGNOSTIC_REPORT_V5.0]</div>
                                <div style={styles.reportStatus}>SYSTEM_STATUS: EXPERT_STABILIZED</div>
                            </div>

                            <div style={styles.reportScroll}>
                                <div style={styles.summaryGrid}>
                                    {Object.entries(reportData.summary || {}).map(([key, data]) => (
                                        <div key={key} style={styles.summaryCard}>
                                            <div style={styles.summaryHeader}>
                                                <span style={styles.summaryLabel}>{key.replace('_', ' ').toUpperCase()}</span>
                                                <span style={{
                                                    ...styles.scorePill,
                                                    background: data.rating >= 8 ? '#00ffaa20' : data.rating >= 5 ? '#ffaa0020' : '#ff005520',
                                                    borderColor: data.rating >= 8 ? '#00ffaa' : data.rating >= 5 ? '#ffaa00' : '#ff0055',
                                                    color: data.rating >= 8 ? '#00ffaa' : data.rating >= 5 ? '#ffaa00' : '#ff0055'
                                                }}>{data.rating}/10</span>
                                            </div>
                                            <p style={styles.summaryAdvice}>{data.advice}</p>
                                        </div>
                                    ))}
                                </div>

                                <div style={styles.sectionHeader}>[GRANULAR_EXPERIENCE_ANALYSIS]</div>

                                {(reportData.experiences || []).map((exp, x) => (
                                    <div key={x} style={styles.experienceGroup}>
                                        <div style={styles.experienceTitle}>{exp.role_at_company}</div>
                                        {exp.analysis.map((bullet, i) => (
                                            <div key={i} style={styles.bulletCard}>
                                                <div style={styles.bulletHeader}>
                                                    <div style={styles.originalBullet}>{bullet.original_bullet}</div>
                                                    <div style={{
                                                        ...styles.scoreCircle,
                                                        borderColor: bullet.rating >= 8 ? '#00ffaa' : bullet.rating >= 5 ? '#ffaa00' : '#ff0055',
                                                        color: bullet.rating >= 8 ? '#00ffaa' : bullet.rating >= 5 ? '#ffaa00' : '#ff0055'
                                                    }}>
                                                        {bullet.rating}
                                                    </div>
                                                </div>
                                                <div style={styles.critiqueText}>{bullet.critique}</div>
                                                <div style={styles.suggestionBox}>
                                                    {(bullet.suggestions || []).map((s, si) => (
                                                        <div key={si} style={styles.suggestionLine}>
                                                            <span style={styles.suggestionLabel}>Armor Upgrade:</span> {s}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}

                                <div style={styles.sectionHeader}>[CORE_UPGRADE_PATH]</div>
                                <div style={styles.upgradeList}>
                                    {(reportData.upgrade_path || []).map((step, i) => (
                                        <div key={i} style={styles.upgradeItem}>
                                            <span style={styles.upgradeNum}>0{i + 1}</span>
                                            <span style={styles.upgradeText}>{step}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={styles.footer}>
                                <button onClick={() => setView('INPUT')} style={styles.resetBtn}>NEW_SCAN</button>
                                <button onClick={onCancel} style={{ ...styles.resetBtn, borderColor: '#ff0055', color: '#ff0055' }}>EXIT_MODULE</button>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ ...styles.corner, top: 0, left: 0, borderTop: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' }}></div>
                <div style={{ ...styles.corner, top: 0, right: 0, borderTop: '2px solid #00f2ff', borderRight: '2px solid #00f2ff' }}></div>
                <div style={{ ...styles.corner, bottom: 0, left: 0, borderBottom: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' }}></div>
                <div style={{ ...styles.corner, bottom: 0, right: 0, borderBottom: '2px solid #00f2ff', borderRight: '2px solid #00f2ff' }}></div>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2, 3, 8, 0.98)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(20px)' },
    modal: { width: '1000px', height: '90vh', background: '#05060f', border: '1px solid rgba(0, 242, 255, 0.1)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 0 100px rgba(0, 242, 255, 0.05)' },
    header: { background: 'rgba(0, 242, 255, 0.03)', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 242, 255, 0.1)' },
    titleGroup: { display: 'flex', alignItems: 'center', gap: '20px' },
    glitchBox: { background: '#00f2ff', color: '#05060f', padding: '4px 12px', fontSize: '12px', fontWeight: '900', fontFamily: '"Roboto Mono", monospace' },
    status: { fontFamily: '"Roboto Mono", monospace', fontSize: '11px', color: 'rgba(0, 242, 255, 0.5)' },
    closeBtn: { background: 'transparent', border: '1px solid #ff0055', color: '#ff0055', padding: '4px 12px', fontSize: '11px', fontFamily: '"Roboto Mono", monospace', cursor: 'pointer' },
    content: { flex: 1, padding: '40px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' },
    dropZone: { height: '100%', border: '2px dashed rgba(0, 242, 255, 0.1)', display: 'flex', flexDirection: 'column', padding: '30px' },
    uploadHUD: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', mb: '30px' },
    instruction: { fontSize: '18px', color: '#00f2ff', fontFamily: '"Roboto Mono", monospace', fontWeight: 'bold' },
    uploadBtn: { background: 'rgba(0, 242, 255, 0.05)', border: '1px solid #00f2ff', color: '#00f2ff', padding: '10px 30px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' },
    divider: { textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', margin: '30px 0' },
    textarea: { flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,242,255,0.1)', color: '#fff', padding: '20px', fontSize: '14px', resize: 'none', outline: 'none' },
    analyzeBtn: { background: '#00f2ff', color: '#05060f', border: 'none', padding: '18px', fontWeight: '900', mt: '20px', cursor: 'pointer', letterSpacing: '2px' },
    scanSection: { flex: 1, display: 'flex', flexDirection: 'column' },
    logContainer: { flex: 1, background: '#000', border: '1px solid rgba(0,242,255,0.1)', display: 'flex', flexDirection: 'column' },
    logHeader: { background: 'rgba(0,242,255,0.05)', padding: '10px', fontSize: '10px', color: 'rgba(0,242,255,0.5)', fontFamily: '"Roboto Mono", monospace' },
    logBody: { flex: 1, padding: '20px', overflowY: 'auto' },
    logStep: { color: '#00f2ff', fontSize: '13px', mb: '8px', fontFamily: '"Roboto Mono", monospace' },
    prompt: { color: '#ff0055', mr: '10px' },
    cursor: { display: 'inline-block', width: '8px', height: '15px', background: '#00f2ff', animation: 'twinkle 1s infinite' },
    retryBtn: { mt: '20px', background: 'transparent', border: '1px solid #ff0055', color: '#ff0055', padding: '12px', cursor: 'pointer' },
    progressBarWrap: { position: 'relative', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '6px', marginBottom: '12px', overflow: 'hidden' },
    progressFill: { height: '10px', background: 'linear-gradient(90deg,#00f2ff,#00ffaa)', transition: 'width 0.2s ease' },
    progressLabel: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ae6ff', padding: '6px 10px', fontFamily: '"Roboto Mono", monospace' },
    reportSection: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    reportHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '25px', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: '15px' },
    reportTitle: { fontSize: '24px', fontWeight: 'bold', color: '#00f2ff', fontFamily: '"Roboto Mono", monospace' },
    reportStatus: { fontSize: '10px', color: '#00ffaa' },
    reportScroll: { flex: 1, overflowY: 'auto', pr: '10px' },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', mb: '40px' },
    summaryCard: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px' },
    summaryHeader: { display: 'flex', justifyContent: 'space-between', mb: '10px' },
    summaryLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.5)' },
    scorePill: { padding: '2px 8px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid' },
    summaryAdvice: { fontSize: '13px', color: '#ccc', lineHeight: '1.5' },
    sectionHeader: { fontSize: '14px', color: '#00f2ff', mb: '20px', mt: '40px', pb: '10px', borderBottom: '1px dashed rgba(0,242,255,0.2)' },
    experienceGroup: { mb: '40px' },
    experienceTitle: { fontSize: '18px', fontWeight: 'bold', color: '#fff', mb: '20px' },
    bulletCard: { background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '25px', mb: '20px', position: 'relative' },
    bulletHeader: { display: 'flex', justifyContent: 'space-between', gap: '30px', mb: '15px' },
    originalBullet: { fontStyle: 'italic', fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6', flex: 1 },
    scoreCircle: { width: '35px', height: '35px', border: '2px solid', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', flexShrink: 0 },
    critiqueText: { fontSize: '14px', color: '#e0e0e0', lineHeight: '1.7', mb: '20px' },
    suggestionBox: { background: 'rgba(0,242,255,0.03)', border: '1px solid rgba(0,242,255,0.1)', padding: '15px' },
    suggestionLine: { fontSize: '14px', color: '#00f2ff', mb: '10px', lineHeight: '1.6' },
    suggestionLabel: { fontWeight: 'bold', mr: '10px' },
    upgradeList: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
    upgradeItem: { background: 'rgba(0,242,255,0.05)', borderLeft: '3px solid #00f2ff', padding: '20px' },
    upgradeNum: { display: 'block', fontSize: '10px', color: '#00f2ff', mb: '10px' },
    upgradeText: { fontSize: '13px', color: '#fff', lineHeight: '1.6' },
    footer: { pt: '30px', mt: 'auto', display: 'flex', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' },
    resetBtn: { flex: 1, padding: '12px', background: 'transparent', border: '1px solid #00f2ff', color: '#00f2ff', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' },
    corner: { position: 'absolute', width: '20px', height: '20px', pointerEvents: 'none' }
};

export default ResumeDiagnostic;
