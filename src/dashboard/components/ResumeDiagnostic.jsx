import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import LocalLLM from '../../background/localLLM.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/pdf.worker.min.js');

const BRAND = '#8e5be8';

const scoreColor = (r) => r >= 8 ? '#10b981' : r >= 5 ? '#f59e0b' : '#f87171';

export default function ResumeDiagnostic({ onCancel }) {
    const [view, setView] = useState('input'); // input | scanning | report
    const [resumeText, setResumeText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [scanSteps, setScanSteps] = useState([]);
    const [progress, setProgress] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [reportData, setReportData] = useState(null);
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);

    const stepLabels = [
        'Parsing resume structure…',
        'Identifying experience sections…',
        'Evaluating bullet strength…',
        'Checking for measurable impact…',
        'Scoring language clarity…',
        'Detecting weak action verbs…',
        'Generating rewrite suggestions…',
        'Building upgrade roadmap…',
        'Finalizing report…',
    ];

    const parsePDF = async (buf) => {
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            let lastY = null, pageText = '';
            for (const item of content.items) {
                const y = item.transform?.[5] ?? null;
                if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) pageText += '\n';
                pageText += item.str;
                if (item.hasEOL) pageText += '\n';
                lastY = y;
            }
            text += pageText + '\n';
        }
        return text;
    };

    const handleFile = async (file) => {
        if (!file) return;
        setFileName(file.name);
        setIsParsing(true);
        try {
            const buf = await file.arrayBuffer();
            let text = '';
            if (file.type === 'application/pdf') text = await parsePDF(buf);
            else if (file.name.endsWith('.docx')) text = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
            else text = await file.text();
            if (!text.trim() || text.trim().length < 10) throw new Error('Empty file');
            setResumeText(text);
        } catch {
            alert('Could not read that file. Try a different format or paste the text directly.');
            setFileName('');
        } finally {
            setIsParsing(false);
        }
    };

    const runAnalysis = async () => {
        if (!resumeText.trim()) return;
        setReportData(null);
        setScanSteps([]);
        setProgress(5);
        setElapsedMs(0);
        setView('scanning');
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsedMs(ms => ms + 1000), 1000);

        let i = 0;
        const interval = setInterval(() => {
            if (i < stepLabels.length) {
                setScanSteps(prev => [...prev, stepLabels[i++]]);
                setProgress(Math.min(75, Math.round(((i + 1) / stepLabels.length) * 70)));
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            } else {
                clearInterval(interval);
                setProgress(80);
                fetchCritique();
            }
        }, 220);
    };

    const normalizeKeys = (obj) => {
        if (Array.isArray(obj)) return obj.map(normalizeKeys);
        if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), normalizeKeys(v)]));
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
                maxTokens: 1500
            });
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);

            const raw = normalizeKeys(json);
            const toScore = (v) => v && typeof v === 'object' ? { rating: Number(v.rating) || 0, advice: v.advice || '' } : { rating: 0, advice: '' };
            const summary = raw.summary || {};
            const experiences = (raw.experiences || []).map(exp => ({
                role_at_company: exp.role_at_company || 'Experience',
                analysis: (exp.analysis || []).map(a => ({
                    original_bullet: a.original_bullet || '',
                    rating: Number(a.rating) || 0,
                    critique: a.critique || '',
                    suggestions: Array.isArray(a.suggestions) ? a.suggestions.filter(Boolean) : []
                })).filter(a => a.original_bullet)
            })).filter(exp => exp.analysis.length > 0);

            setReportData({
                summary: {
                    structural_integrity: toScore(summary.structural_integrity),
                    signal_strength: toScore(summary.signal_strength),
                    tech_arity: toScore(summary.tech_arity)
                },
                experiences,
                upgrade_path: (raw.upgrade_path || []).filter(Boolean)
            });
            setTimeout(() => setView('report'), 600);
        } catch (err) {
            setProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);
            setScanSteps(prev => [...prev, `Error: ${err?.message || 'Analysis failed'}. Make sure your LLM is running.`]);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(244,247,251,0.76)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 860, maxHeight: '90vh', background: '#ffffff',
                border: '1px solid #d7e0ec', borderRadius: 16,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(15,23,40,0.14)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 24px', borderBottom: '1px solid #d7e0ec',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f1728' }}>Resume Diagnostic</div>
                        <div style={{ fontSize: 12, color: '#6f8299', marginTop: 1 }}>
                            {fileName ? fileName : 'Upload or paste your resume'}
                        </div>
                    </div>
                    <button onClick={onCancel} style={{
                        background: '#ffffff', border: '1px solid #d7e0ec',
                        color: '#6a5f7e', padding: '6px 14px', borderRadius: 7,
                        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                    }}>Close</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

                    {/* INPUT */}
                    {view === 'input' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
                                style={{
                                    border: `2px dashed ${isDragging ? BRAND : '#c5d3e6'}`,
                                    borderRadius: 12, padding: '32px 24px',
                                    textAlign: 'center', transition: 'border-color 0.2s',
                                    background: isDragging ? `${BRAND}10` : '#f8fbff'
                                }}
                            >
                                <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1728', marginBottom: 6 }}>
                                    {isParsing ? 'Reading file…' : 'Drop your resume here'}
                                </div>
                                <div style={{ fontSize: 13, color: '#6f8299', marginBottom: 16 }}>
                                    Supports .PDF, .DOCX, and .TXT
                                </div>
                                <input
                                    type="file" ref={fileInputRef} style={{ display: 'none' }}
                                    onChange={e => handleFile(e.target.files[0])} accept=".pdf,.docx,.txt"
                                />
                                <button
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={isParsing}
                                    style={{
                                        background: '#ffffff', border: '1px solid #d7e0ec',
                                        color: '#4b6078', padding: '8px 20px', borderRadius: 8,
                                        fontSize: 13, cursor: isParsing ? 'not-allowed' : 'pointer',
                                        fontFamily: 'inherit', opacity: isParsing ? 0.5 : 1
                                    }}
                                >
                                    {isParsing ? 'Reading…' : fileName ? 'Change file' : 'Choose file'}
                                </button>
                            </div>

                            <div style={{ textAlign: 'center', fontSize: 13, color: '#6f8299' }}>or paste your resume below</div>

                            <textarea
                                value={resumeText}
                                onChange={e => setResumeText(e.target.value)}
                                placeholder="Paste your resume text here…"
                                style={{
                                    flex: 1, minHeight: 200,
                                    background: '#ffffff', border: '1px solid #d7e0ec',
                                    borderRadius: 10, color: '#0f1728', padding: '16px',
                                    fontSize: 14, lineHeight: 1.6, resize: 'vertical',
                                    outline: 'none', fontFamily: 'inherit',
                                    '::placeholder': { color: '#8ca0b8' }
                                }}
                            />

                            <button
                                onClick={runAnalysis}
                                disabled={!resumeText.trim() || isParsing}
                                style={{
                                    background: BRAND, color: '#fff', border: 'none',
                                    padding: '14px', borderRadius: 10, fontSize: 14,
                                    fontWeight: 600, cursor: (!resumeText.trim() || isParsing) ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', opacity: (!resumeText.trim() || isParsing) ? 0.5 : 1,
                                    transition: 'opacity 0.15s'
                                }}
                            >
                                Analyze Resume
                            </button>
                        </div>
                    )}

                    {/* SCANNING */}
                    {view === 'scanning' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{
                                    height: 6, background: '#d7e0ec', borderRadius: 100, overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%', width: `${progress}%`,
                                        background: `linear-gradient(90deg, ${BRAND}, #d56cc7)`,
                                        borderRadius: 100, transition: 'width 0.3s ease'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                    <span style={{ fontSize: 12, color: '#6f8299' }}>{Math.round(elapsedMs / 1000)}s elapsed</span>
                                    <span style={{ fontSize: 12, color: '#6f8299' }}>{progress}%</span>
                                </div>
                            </div>

                            <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {scanSteps.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                            background: '#10b98120', border: '1px solid #10b98150',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, color: '#10b981'
                                        }}>✓</div>
                                        <span style={{ fontSize: 14, color: '#4b6078' }}>{s}</span>
                                    </div>
                                ))}
                                {progress < 100 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                            border: `2px solid ${BRAND}`, borderTopColor: 'transparent',
                                            animation: 'spin 0.8s linear infinite'
                                        }} />
                                        <span style={{ fontSize: 14, color: '#5b708a' }}>Analyzing…</span>
                                    </div>
                                )}
                                {scanSteps.some(s => s.startsWith('Error:')) && (
                                    <button onClick={() => { setView('input'); setProgress(0); }} style={{
                                        marginTop: 16, background: '#ffffff', border: '1px solid #d7e0ec',
                                        color: '#4b6078', padding: '10px 24px', borderRadius: 8,
                                        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start'
                                    }}>Try again</button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* REPORT */}
                    {view === 'report' && reportData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                            {/* Summary scores */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                                {Object.entries(reportData.summary).map(([key, data]) => (
                                    <div key={key} style={{
                                        background: '#f8fbff', border: '1px solid #d7e0ec',
                                        borderRadius: 12, padding: '18px 16px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#6f8299', textTransform: 'capitalize' }}>
                                                {key.replace(/_/g, ' ')}
                                            </span>
                                            <span style={{
                                                fontSize: 13, fontWeight: 700,
                                                color: scoreColor(data.rating),
                                                background: `${scoreColor(data.rating)}18`,
                                                border: `1px solid ${scoreColor(data.rating)}40`,
                                                padding: '2px 8px', borderRadius: 6
                                            }}>{data.rating}/10</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.55, margin: 0 }}>{data.advice}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Experience bullets */}
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1728', marginBottom: 16 }}>Bullet-by-bullet analysis</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {reportData.experiences.map((exp, xi) => (
                                        <div key={xi}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#7a45c7', marginBottom: 12 }}>{exp.role_at_company}</div>
                                            {exp.analysis.map((bullet, i) => (
                                                <div key={i} style={{
                                                    background: '#f8fbff', border: '1px solid #d7e0ec',
                                                    borderRadius: 10, padding: '18px 20px', marginBottom: 10
                                                }}>
                                                    <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                                            border: `2px solid ${scoreColor(bullet.rating)}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 14, fontWeight: 800, color: scoreColor(bullet.rating)
                                                        }}>{bullet.rating}</div>
                                                        <p style={{ fontSize: 14, color: '#4b6078', fontStyle: 'italic', lineHeight: 1.6, margin: 0, flex: 1 }}>
                                                            "{bullet.original_bullet}"
                                                        </p>
                                                    </div>
                                                    <p style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.6, marginBottom: 12 }}>{bullet.critique}</p>
                                                    {bullet.suggestions.length > 0 && (
                                                        <div style={{
                                                            background: `${BRAND}0d`, border: `1px solid ${BRAND}30`,
                                                            borderRadius: 8, padding: '12px 14px',
                                                            display: 'flex', flexDirection: 'column', gap: 8
                                                        }}>
                                                            {bullet.suggestions.map((s, si) => (
                                                                <div key={si} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                                    <span style={{ fontSize: 11, color: BRAND, fontWeight: 700, marginTop: 2, flexShrink: 0 }}>Rewrite</span>
                                                                    <span style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.55 }}>{s}</span>
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

                            {/* Upgrade path */}
                            {reportData.upgrade_path.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1728', marginBottom: 14 }}>Top improvements</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                        {reportData.upgrade_path.map((tip, i) => (
                                            <div key={i} style={{
                                                background: '#f8fbff', borderLeft: `3px solid ${BRAND}`,
                                                borderRadius: '0 10px 10px 0', padding: '14px 16px',
                                                display: 'flex', gap: 12
                                            }}>
                                                <span style={{ fontSize: 11, fontWeight: 800, color: BRAND, flexShrink: 0 }}>0{i + 1}</span>
                                                <span style={{ fontSize: 13, color: '#4b6078', lineHeight: 1.55 }}>{tip}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Footer actions */}
                            <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #d7e0ec' }}>
                                <button onClick={() => { setView('input'); setReportData(null); setProgress(0); setScanSteps([]); }} style={{
                                    flex: 1, padding: '11px', background: '#ffffff',
                                    border: '1px solid #d7e0ec', color: '#4b6078',
                                    borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                                }}>New scan</button>
                                <button onClick={onCancel} style={{
                                    flex: 1, padding: '11px', background: '#ffffff',
                                    border: '1px solid #d7e0ec', color: '#4b6078',
                                    borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                                }}>Close</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
