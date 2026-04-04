import React, { useState, useRef, useEffect } from 'react';
import { fetchCompanyIntel } from '../../services/companyIntelService.js';
import { useMediaQuery } from '../utils/useMediaQuery.js';

const BRAND = '#8e5be8';
const STEP_INTERVAL_MS = 320;

const DeepScan = ({ job, onCancel }) => {
    const isNarrow = useMediaQuery('(max-width: 720px)');
    const [phase, setPhase] = useState('ready'); // ready | scanning | done | error
    const [steps, setSteps] = useState([]);
    const [report, setReport] = useState(null);
    const [errorDetail, setErrorDetail] = useState(null);
    const [elapsedSec, setElapsedSec] = useState(0);
    const scrollRef = useRef(null);
    const stepIntervalRef = useRef(null);

    useEffect(() => {
        if (phase !== 'scanning') {
            setElapsedSec(0);
            return;
        }
        const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [phase]);

    useEffect(() => {
        return () => {
            if (stepIntervalRef.current) {
                clearInterval(stepIntervalRef.current);
                stepIntervalRef.current = null;
            }
        };
    }, []);

    const scanStepLabels = [
        `Searching for ${job.company}…`,
        'Pulling company summary & hiring signals…',
        'Reading culture and news context…',
        'Scanning interview patterns…',
        'Compiling intel report…',
    ];

    const clearStepTimer = () => {
        if (stepIntervalRef.current) {
            clearInterval(stepIntervalRef.current);
            stepIntervalRef.current = null;
        }
    };

    const runScan = () => {
        setErrorDetail(null);
        setPhase('scanning');
        setSteps([]);
        clearStepTimer();
        let i = 0;
        stepIntervalRef.current = setInterval(() => {
            if (i < scanStepLabels.length) {
                setSteps(prev => [...prev, scanStepLabels[i++]]);
                scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }, STEP_INTERVAL_MS);
        fetchReport();
    };

    const fetchReport = async () => {
        try {
            const result = await fetchCompanyIntel({
                company: job.company,
                title: job.title || 'a candidate',
                temperature: 0.35,
                fast: true
            });
            clearStepTimer();
            setReport(result);
            setSteps((prev) => (prev.length >= scanStepLabels.length ? prev : [...scanStepLabels]));
            setPhase('done');
        } catch (err) {
            clearStepTimer();
            console.error('[DeepScan]', err);
            const msg = err?.message || String(err);
            setErrorDetail(msg.length > 220 ? `${msg.slice(0, 220)}…` : msg);
            setPhase('error');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(244,247,251,0.76)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: isNarrow ? 'flex-end' : 'center', justifyContent: 'center',
            padding: isNarrow ? '0' : '16px',
            paddingBottom: isNarrow ? 'env(safe-area-inset-bottom, 0px)' : '16px',
        }}>
            <div style={{
                width: isNarrow ? '100%' : 780,
                maxWidth: isNarrow ? '100%' : 780,
                maxHeight: isNarrow ? 'min(92dvh, 100% - env(safe-area-inset-top))' : '88vh',
                background: '#ffffff',
                border: isNarrow ? 'none' : '1px solid #d7e0ec',
                borderRadius: isNarrow ? '16px 16px 0 0' : 16,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: isNarrow ? '0 -12px 48px rgba(15,23,40,0.12)' : '0 20px 60px rgba(15,23,40,0.14)'
            }}>
                {/* Header */}
                <div style={{
                    padding: isNarrow ? '14px 16px' : '18px 24px', borderBottom: '1px solid #d7e0ec',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0, gap: 12, flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10, background: '#f3eaff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15, fontWeight: 700, color: '#6f5b90'
                        }}>
                            {(job.company || '?')[0].toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f1728' }}>Company Intel</div>
                            <div style={{ fontSize: 12, color: '#6f8299', marginTop: 1 }}>{job.company}</div>
                        </div>
                    </div>
                    <button onClick={onCancel} style={{
                        background: '#ffffff', border: '1px solid #d7e0ec',
                        color: '#6a5f7e', padding: '6px 14px', borderRadius: 7,
                        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                    }}>Close</button>
                </div>

                {/* Body */}
                <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: isNarrow ? '18px 16px calc(20px + env(safe-area-inset-bottom, 0px))' : 28,
                    WebkitOverflowScrolling: 'touch',
                }}>

                    {phase === 'ready' && (
                        <div style={{ textAlign: 'center', padding: '60px 40px' }}>
                            <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f1728', marginBottom: 8 }}>
                                Ready to research {job.company}
                            </div>
                            <div style={{ fontSize: 14, color: '#5b708a', marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>
                                Get culture insights, recent news, interview tips, and a risk/reward assessment.
                            </div>
                            <button onClick={runScan} style={{
                                background: BRAND, color: '#fff', border: 'none',
                                padding: '12px 32px', borderRadius: 10, fontSize: 14,
                                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                            }}>
                                Run Analysis
                            </button>
                        </div>
                    )}

                    {(phase === 'scanning' || (phase === 'done' && steps.length > 0 && !report)) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {steps.map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 20, height: 20, borderRadius: '50%',
                                        background: '#10b98120', border: '1px solid #10b98150',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, color: '#10b981', flexShrink: 0
                                    }}>✓</div>
                                    <span style={{ fontSize: 14, color: '#4b6078' }}>{s}</span>
                                </div>
                            ))}
                            {phase === 'scanning' && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%',
                                            border: `2px solid ${BRAND}`, borderTopColor: 'transparent',
                                            animation: 'spin 0.8s linear infinite', flexShrink: 0
                                        }} />
                                        <span style={{ fontSize: 14, color: '#5b708a' }}>Working…</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#7d92a8', marginTop: 10, lineHeight: 1.5, maxWidth: 420 }}>
                                        Fast mode uses fewer search hits and a shorter answer. On CPU, expect on the order of <strong>1–3 minutes</strong> for the local model; GPU is much quicker.
                                        {elapsedSec > 0 && (
                                            <span> Elapsed: {elapsedSec}s</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    )}

                    {phase === 'done' && report && (
                        <div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #d7e0ec'
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                                <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>Analysis complete</span>
                            </div>

                            <div style={{ fontSize: 14, color: '#4b6078', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 28 }}>
                                {report}
                            </div>

                            <div style={{ borderTop: '1px solid #d7e0ec', paddingTop: 20 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#6f8299', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    External links
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {[
                                        { label: 'Google News', url: `https://www.google.com/search?q=${encodeURIComponent(job.company + ' recent news')}&tbm=nws` },
                                        { label: 'LinkedIn', url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(job.company)}` },
                                        { label: 'Glassdoor', url: `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(job.company)}` },
                                        { label: 'Company Website', url: `https://www.google.com/search?q=${encodeURIComponent(job.company + ' official site')}` },
                                    ].map(link => (
                                        <button key={link.label} onClick={() => window.open(link.url, '_blank')} style={{
                                            background: '#ffffff', border: '1px solid #d7e0ec',
                                            color: '#4b6078', padding: '10px 16px', borderRadius: 8,
                                            fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                            fontFamily: 'inherit', textAlign: 'left',
                                            transition: 'all 0.15s'
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${BRAND}60`; e.currentTarget.style.color = '#0f1728'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d7e0ec'; e.currentTarget.style.color = '#4b6078'; }}
                                        >
                                            {link.label} ↗
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {phase === 'error' && (
                        <div style={{ textAlign: 'center', padding: '60px 40px' }}>
                            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f1728', marginBottom: 8 }}>Analysis failed</div>
                            {errorDetail && (
                                <div style={{
                                    fontSize: 12, color: '#64748b', marginBottom: 20, textAlign: 'left',
                                    maxWidth: 520, marginLeft: 'auto', marginRight: 'auto',
                                    padding: 12, background: '#f8fafc', borderRadius: 8,
                                    border: '1px solid #e2e8f0', fontFamily: 'ui-monospace, monospace',
                                    wordBreak: 'break-word'
                                }}>
                                    {errorDetail}
                                </div>
                            )}
                            <button onClick={() => { setPhase('ready'); setSteps([]); setErrorDetail(null); }} style={{
                                background: '#ffffff', border: '1px solid #d7e0ec',
                                color: '#4b6078', padding: '10px 24px', borderRadius: 8,
                                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                            }}>Try again</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeepScan;
