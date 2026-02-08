import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/pdf.worker.min.js');

const ResumeDiagnostic = ({ onCancel }) => {
    const [view, setView] = useState('INPUT');
    const [resumeText, setResumeText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [scanSteps, setScanSteps] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);

    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const HARDCODED_API_KEY = ""; // User must provide key in options

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
        setView('SCANNING');

        let i = 0;
        const interval = setInterval(() => {
            if (i < steps.length) {
                setScanSteps(prev => [...prev, steps[i++]]);
            } else {
                clearInterval(interval);
                fetchCritique();
            }
        }, 210);
    };

    const getValidKey = async () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['groqApiKey'], (items) => {
                const key = items.groqApiKey || HARDCODED_API_KEY;
                resolve(key);
            });
        });
    };

    const fetchCritique = async () => {
        try {
            setScanSteps(prev => [
                ...prev,
                "LINK_TYPE: GROQ_ULTRA_DAEMON",
                "ROUTING_TO_CORE_GATEWAY..."
            ]);

            const apiKey = await getValidKey();

            const prompt = `
You are an expert technical resume reviewer.

Return ONLY valid JSON. No markdown. No explanations.

=====================
SCORING RUBRIC (MANDATORY)

Rate each item from 1–10:

1–2: Task-only, vague, no impact, weak verbs
3–4: Clear task, no metrics, low specificity
5–6: Solid responsibility, missing quantified impact
7–8: Strong action + clear result OR tech stack present
9–10: Excellent: action + quantified impact + tech/context

Rules:
- Analyze EVERY bullet point found in the resume. Do not skip any.
- Do NOT combine or summarize multiple bullet points. Analyze each separately.
- If NO numbers are present → rating MUST be 6 or lower
- If bullet starts with weak verbs (helped, assisted, worked on) → max rating 5
- If bullet contains real metrics → minimum rating 7
- Use the FULL 1–10 range

=====================
ANTI-HALLUCINATION RULE (CRITICAL)

When suggesting improvements:
- NEVER invent numbers
- If no metrics exist, use ONLY placeholders:
  - X%
  - X+
  - N+
  - <metric>

✘ "increased revenue by 27%"
✔ "increased revenue by X%"

If rule is violated → response is invalid.

=====================
FORMULA (STRICT)

[Strong Action Verb] + [Impact w/ placeholder] + [Tech / Context]

=====================
OUTPUT STRUCTURE

{
  "summary": {
    "structural_integrity": { "rating": 0, "advice": "" },
    "signal_strength": { "rating": 0, "advice": "" },
    "tech_arity": { "rating": 0, "advice": "" }
  },
  "experiences": [
    {
      "role_at_company": "",
      "analysis": [
        {
          "original_bullet": "",
          "rating": 0,
          "critique": "",
          "suggestions": [
            "Improved system performance by X% using [tech/context]",
            "Reduced manual effort by X% through [tool/process]"
          ]
        }
      ]
    }
  ],
  "upgrade_path": ["", "", ""]
}

=====================
RESUME:
${resumeText}
`;

            setScanSteps(prev => [...prev, "INITIATING_CORE_INFERENCE..."]);

            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.25,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("INVALID_API_KEY");
                }
                const errData = await response.json();
                throw new Error(`CLOUD_FAILURE: ${errData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const rawResponse = data.choices[0].message.content;
            const cleanJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            const jsonResponse = JSON.parse(cleanJson);

            setReportData(jsonResponse);
            setScanSteps(prev => [...prev, "SCAN_COMPLETE. DATA_STABILIZED."]);
            setTimeout(() => setView('REPORT'), 1000);

        } catch (error) {
            if (error.message === "INVALID_API_KEY") {
                setScanSteps(prev => [
                    ...prev,
                    "[CRITICAL_FAILURE] ACCESS_DENIED (401)",
                    "CAUSE: API KEY EXPIRED OR INVALID",
                    "ACTION_REQUIRED: REGENERATE_ACCESS_TOKEN"
                ]);
                // We'll handle the UI button in the view render
            } else {
                setScanSteps(prev => [
                    ...prev,
                    `[CRITICAL_FAILURE] ${error?.message?.toUpperCase()}`,
                    "ADVICE: Check Groq API Key in Extension Options."
                ]);
            }
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
                            <div style={styles.logContainer}>
                                <div style={styles.logHeader}>[DIAGNOSTIC_TERMINAL]</div>
                                <div style={styles.logBody} ref={scrollRef}>
                                    {scanSteps.map((step, i) => (
                                        <div key={i} style={styles.logStep}><span style={styles.prompt}>[SCAN]</span> {step}</div>
                                    ))}
                                    {(!reportData && !scanSteps.some(s => s && s.includes('ERROR'))) && <div style={styles.cursor}>_</div>}
                                </div>
                            </div>
                            {scanSteps.some(s => s && s.includes('INVALID_KEY') || s.includes('ACCESS_DENIED')) ? (
                                <button onClick={() => chrome.runtime.openOptionsPage()} style={styles.retryBtn}>
                                    ⚠ REGENERATE_ACCESS_TOKEN
                                </button>
                            ) : scanSteps.some(s => s && s.includes('ERROR')) && (
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
