
import React, { useState, useEffect, useRef } from 'react';

const DeepScan = ({ job, onCancel }) => {
    const [scanSteps, setScanSteps] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [report, setReport] = useState(null);
    const scrollRef = useRef(null);

    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const HARDCODED_API_KEY = ""; // User must provide key in options

    const steps = [
        "INITIALIZING_VORTEX_PROTOCOL...",
        "STABLIZING_COMMS_RELAY...",
        `TARGETING_ENTITY: ${job.company.toUpperCase()}`,
        "SEARCHING_GLOBAL_DATABASE...",
        "ANALYZING_MARKET_SENTIMENT...",
        "EXTRACTING_CULTURAL_FEEDS...",
        "DECRYPTING_INTERVIEW_PATTERNS...",
        "FINALIZING_INTELLIGENCE_REPORT..."
    ];

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [scanSteps]);

    const runScan = () => {
        setIsScanning(true);
        setScanSteps([]);
        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                setScanSteps(prev => [...prev, steps[currentStep]]);
                currentStep++;
            } else {
                clearInterval(interval);
                fetchDeepScan();
            }
        }, 600);
    };

    const fetchDeepScan = async () => {
        try {
            const prompt = `
You are a high-level corporate intelligence AI. 
Provide a "Deep Scan" intelligence report for the company "${job.company}".
The user is applying for the role of "${job.title || 'a position'}".

Format the response in a futuristic terminal style with the following sections:
1. [EXECUTIVE_SUMMARY] - 2-3 sentences about what the company does and its market position.
2. [CULTURAL_DNA] - Insights into their work culture and values.
3. [RECENT_INTEL] - Recent news, product launches, or market shifts (based on your training data).
4. [TACTICAL_ADVICE] - 3 specific tips for interviewing at this specific company.
5. [SENTIMENT_ANALYSIS] - A brief "Risk vs Reward" assessment.

Use a techy, cyberpunk/terminal tone. Use brackets for headers.
`;

            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HARDCODED_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.5
                }),
            });

            const data = await response.json();
            setReport(data.choices[0].message.content);
            setIsScanning(false);
        } catch (error) {
            setScanSteps(prev => [...prev, "[ERROR] INTELLIGENCE_GATHERING_FAILED. RETRY_LATER."]);
            setIsScanning(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <div style={styles.titleGroup}>
                        <div style={styles.glitchBox}>DEEP_SCAN</div>
                        <span style={styles.target}>TARGET: {job.company}</span>
                    </div>
                    <button onClick={onCancel} style={styles.closeBtn}>EXIT_TERMINAL</button>
                </div>

                <div style={styles.terminalContainer}>
                    {!isScanning && !report ? (
                        <div style={styles.readyScreen}>
                            <div style={styles.readyText}>INTELLIGENCE_LINK_READY</div>
                            <button onClick={runScan} style={styles.readyBtn}>INITIATE_VORTEX_DAEMON</button>
                        </div>
                    ) : (
                        <>
                            <div style={styles.log}>
                                {scanSteps.map((step, i) => (
                                    <div key={i} style={styles.logStep}>
                                        <span style={styles.prompt}>$</span> {step}
                                    </div>
                                ))}
                                {isScanning && <div style={styles.cursor}>_</div>}
                                <div ref={scrollRef} />
                            </div>

                            {!isScanning && report && (
                                <div style={styles.reportContainer}>
                                    <div style={styles.reportHeader}>[INTELLIGENCE_REPORT_V1.0.4]</div>
                                    <pre style={styles.reportContent}>{report}</pre>

                                    <div style={styles.commandSection}>
                                        <div style={styles.commandHeader}>[COMMAND_LINK_INTERFACE]</div>
                                        <div style={styles.commandGrid}>
                                            <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(job.company + ' recent news')}&tbm=nws`, '_blank')} style={styles.cmdBtn}>
                                                [ACCESS_GOOGLE_NEWS]
                                            </button>
                                            <button onClick={() => window.open(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(job.company)}`, '_blank')} style={styles.cmdBtn}>
                                                [ACCESS_LINKEDIN_INTEL]
                                            </button>
                                            <button onClick={() => window.open(`https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(job.company)}`, '_blank')} style={styles.cmdBtn}>
                                                [ACCESS_GLASSDOOR]
                                            </button>
                                            <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(job.company + ' official site')}`, '_blank')} style={styles.cmdBtn}>
                                                [ACCESS_WEBSITE]
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Corner Accents */}
                <div style={{ ...styles.corner, top: 0, left: 0, borderTop: '2px solid #7000ff', borderLeft: '2px solid #7000ff' }}></div>
                <div style={{ ...styles.corner, top: 0, right: 0, borderTop: '2px solid #7000ff', borderRight: '2px solid #7000ff' }}></div>
                <div style={{ ...styles.corner, bottom: 0, left: 0, borderBottom: '2px solid #7000ff', borderLeft: '2px solid #7000ff' }}></div>
                <div style={{ ...styles.corner, bottom: 0, right: 0, borderBottom: '2px solid #7000ff', borderRight: '2px solid #7000ff' }}></div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(2, 3, 8, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        backdropFilter: 'blur(15px)'
    },
    modal: {
        width: '900px',
        height: '85vh',
        background: '#05060f',
        border: '1px solid #7000ff50',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 0 100px rgba(112, 0, 255, 0.2)',
        overflow: 'hidden'
    },
    header: {
        background: 'rgba(112, 0, 255, 0.1)',
        padding: '15px 25px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #7000ff30'
    },
    titleGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
    },
    glitchBox: {
        background: '#7000ff',
        color: '#fff',
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: '900',
        fontFamily: '"Roboto Mono", monospace',
        letterSpacing: '2px'
    },
    target: {
        fontFamily: '"Roboto Mono", monospace',
        fontSize: '12px',
        color: '#d4a5ff',
        opacity: 0.8
    },
    closeBtn: {
        background: 'transparent',
        border: '1px solid #ff0055',
        color: '#ff0055',
        padding: '4px 12px',
        fontSize: '11px',
        fontFamily: '"Roboto Mono", monospace',
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    terminalContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '30px'
    },
    readyScreen: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '25px'
    },
    readyText: {
        fontSize: '18px',
        fontFamily: '"Roboto Mono", monospace',
        color: '#7000ff',
        fontWeight: '900',
        letterSpacing: '4px'
    },
    readyBtn: {
        background: 'transparent',
        border: '1px solid #7000ff',
        color: '#7000ff',
        padding: '15px 30px',
        fontFamily: '"Roboto Mono", monospace',
        cursor: 'pointer',
        fontWeight: '900',
        transition: 'all 0.3s ease'
    },
    log: {
        fontFamily: '"Roboto Mono", monospace',
        fontSize: '13px',
        color: '#00f2ff',
        marginBottom: '30px'
    },
    logStep: {
        marginBottom: '8px'
    },
    prompt: {
        color: '#ff0055',
        marginRight: '10px'
    },
    cursor: {
        display: 'inline-block',
        width: '8px',
        height: '15px',
        background: '#00f2ff',
        animation: 'twinkle 1s infinite'
    },
    reportContainer: {
        borderTop: '1px dashed rgba(112, 0, 255, 0.3)',
        paddingTop: '30px'
    },
    reportHeader: {
        fontFamily: '"Roboto Mono", monospace',
        fontSize: '18px',
        fontWeight: '900',
        color: '#7000ff',
        marginBottom: '20px',
        textShadow: '0 0 10px rgba(112, 0, 255, 0.5)'
    },
    reportContent: {
        fontFamily: '"Inter", sans-serif',
        fontSize: '15px',
        lineHeight: '1.8',
        color: '#e0e0e0',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
    },
    corner: {
        position: 'absolute',
        width: '20px',
        height: '20px',
        pointerEvents: 'none'
    },
    commandSection: {
        marginTop: '30px',
        borderTop: '1px dashed rgba(112, 0, 255, 0.3)',
        paddingTop: '20px'
    },
    commandHeader: {
        fontSize: '12px',
        color: '#7000ff',
        fontWeight: '900',
        marginBottom: '15px',
        fontFamily: '"Roboto Mono", monospace',
        letterSpacing: '2px'
    },
    commandGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '15px'
    },
    cmdBtn: {
        background: 'rgba(112, 0, 255, 0.1)',
        border: '1px solid #7000ff',
        color: '#d4a5ff',
        padding: '12px',
        cursor: 'pointer',
        fontFamily: '"Roboto Mono", monospace',
        fontSize: '11px',
        fontWeight: 'bold',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        textTransform: 'uppercase'
    }
};

export default DeepScan;
