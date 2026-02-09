
import React, { useState, useEffect, useRef } from 'react';

const InterviewSimulator = ({ job, mode = 'interview', onCancel }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isGlitching, setIsGlitching] = useState(false);
    const chatEndRef = useRef(null);

    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        startSimulation();
    }, [mode]);

    const startSimulation = async () => {
        const content = mode === 'follow-up'
            ? `[SIGNAL_BOOSTER_INITIALIZED] \n\nTarget lead at ${job.company} has gone cold. I am ready to draft a high-impact follow-up signal. \n\nWhat specific angle should we take? (e.g., "gentle nudge", "mentioning a recent project", "asking for timeline")`
            : `[COMMS_LINK_ESTABLISHED] \n\nInitiating recruitment simulation for ${job.role || 'NULL'} position at ${job.company || 'UNKNOWN'}. \n\nI am your simulated lead interviewer. State your readiness to begin the evaluation.`;

        setMessages([{ role: 'assistant', content }]);
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const apiKey = await new Promise((resolve, reject) => {
                chrome.storage.sync.get(['groqApiKey'], (result) => {
                    if (result.groqApiKey) resolve(result.groqApiKey);
                    else reject(new Error("MISSING_API_KEY"));
                });
            });

            const systemPrompt = mode === 'follow-up'
                ? `You are an expert career coach and strategist. Help the user draft a professional, high-impact follow-up email for a ${job.role} position at ${job.company}.
                   Keep it concise, techy, and strategic. Offer 2-3 variations based on the user's input. 
                   Surround status messages in brackets like [GENERATING_DRAFT].`
                : `You are a professional, slightly intense tech interviewer simulation for a ${job.role} position at ${job.company}. 
                   Ask ONE targeted technical or behavioral question at a time. Use a "Mission Control" persona.`;

            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...messages.slice(-6),
                        userMsg
                    ],
                    temperature: 0.7
                }),
            });

            const data = await response.json();
            const aiText = data.choices[0].message.content;

            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);

            if (Math.random() > 0.7) {
                setIsGlitching(true);
                setTimeout(() => setIsGlitching(false), 300);
            }
        } catch (error) {
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'assistant', content: "[ERROR: SIGNAL_INTERRUPTED] Link lost." }]);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={{ ...styles.modal, animation: isGlitching ? 'glitch 0.2s infinite' : 'none', borderColor: mode === 'follow-up' ? '#ff005570' : 'rgba(0, 242, 255, 0.3)' }}>
                <div style={{ ...styles.header, background: mode === 'follow-up' ? 'rgba(255, 0, 85, 0.05)' : 'rgba(0, 242, 255, 0.05)' }}>
                    <div style={styles.statusGroup}>
                        <div style={{ ...styles.pulse, backgroundColor: mode === 'follow-up' ? '#ff0055' : '#00f2ff', boxShadow: `0 0 10px ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}` }}></div>
                        <span style={{ ...styles.statusText, color: mode === 'follow-up' ? '#ff0055' : '#00f2ff' }}>
                            {mode === 'follow-up' ? 'SIGNAL_BOOSTER_ACTIVE' : 'SIMULATION_ACTIVE'} // MODE: {mode.toUpperCase()}
                        </span>
                    </div>
                    <button onClick={onCancel} style={styles.closeBtn}>TERMINATE_LINK</button>
                </div>

                <div style={styles.chatContainer}>
                    <div style={{ ...styles.jobInfo, borderLeft: `4px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}` }}>
                        <div style={styles.infoLabel}>TARGET:</div>
                        <div style={styles.infoValue}>{job.company} // {job.role}</div>
                        <div style={styles.infoLabel}>LAST_SIGNAL:</div>
                        <div style={styles.infoValue}>{new Date(job.date).toLocaleDateString()}</div>
                    </div>

                    <div style={styles.messagesList}>
                        {messages.map((m, i) => (
                            <div key={i} style={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
                                <div style={styles.msgBadge}>{m.role === 'user' ? '> OPERATOR' : '> CORE_AI'}</div>
                                <div style={{ ...styles.msgContent, borderLeft: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}` }}>{m.content}</div>
                            </div>
                        ))}
                        {isTyping && <div style={{ ...styles.typingIndicator, color: mode === 'follow-up' ? '#ff0055' : '#00f2ff' }}>[PROCESSING_RESPONSE_STREAM...]</div>}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                <form onSubmit={sendMessage} style={styles.inputArea}>
                    <input
                        autoFocus
                        style={styles.input}
                        placeholder="ENTER COMMAND..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isTyping}
                    />
                    <button type="submit" style={{ ...styles.sendBtn, background: mode === 'follow-up' ? '#ff0055' : '#00f2ff' }} disabled={isTyping}>TRANSMIT</button>
                </form>

                <div style={{ ...styles.corner, top: 0, left: 0, borderTop: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}`, borderLeft: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}` }}></div>
                <div style={{ ...styles.corner, top: 0, right: 0, borderTop: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}`, borderRight: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}` }}></div>
                <div style={{ ...styles.corner, bottom: 0, left: 0, borderBottom: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}`, borderLeft: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}` }}></div>
                <div style={{ ...styles.corner, bottom: 0, right: 0, borderBottom: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}`, borderRight: `2px solid ${mode === 'follow-up' ? '#ff0055' : '#00f2ff'}` }}></div>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 6, 15, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(10px)' },
    modal: { width: '700px', height: '80vh', background: 'rgba(15, 17, 34, 0.95)', border: '1px solid rgba(0, 242, 255, 0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 0 50px rgba(0, 242, 255, 0.1)', overflow: 'hidden' },
    header: { padding: '20px', borderBottom: '1px solid rgba(0, 242, 255, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    statusGroup: { display: 'flex', alignItems: 'center', gap: '10px' },
    pulse: { width: '8px', height: '8px', borderRadius: '50%', animation: 'pulse-glow 1.5s infinite' },
    statusText: { fontSize: '11px', fontFamily: '"Roboto Mono", monospace', fontWeight: '700', letterSpacing: '1px' },
    closeBtn: { background: 'transparent', border: '1px solid #ff0055', color: '#ff0055', padding: '5px 12px', fontSize: '10px', fontFamily: '"Roboto Mono", monospace', cursor: 'pointer', fontWeight: 'bold' },
    chatContainer: { flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' },
    jobInfo: { padding: '15px', background: 'rgba(255, 255, 255, 0.02)', display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px', fontSize: '12px', fontFamily: '"Roboto Mono", monospace' },
    infoLabel: { color: 'rgba(255, 255, 255, 0.4)', fontWeight: 'bold' },
    infoValue: { color: '#fff', fontWeight: 'bold' },
    messagesList: { display: 'flex', flexDirection: 'column', gap: '20px' },
    aiMsg: { alignSelf: 'flex-start', maxWidth: '85%' },
    userMsg: { alignSelf: 'flex-end', maxWidth: '85%', textAlign: 'right' },
    msgBadge: { fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: 'rgba(255, 255, 255, 0.3)', marginBottom: '5px' },
    msgContent: { padding: '15px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: '#e0e0e0', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-line' },
    typingIndicator: { fontSize: '11px', fontFamily: '"Roboto Mono", monospace', animation: 'twinkle 1s infinite' },
    inputArea: { padding: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '15px', background: 'rgba(0, 0, 0, 0.3)' },
    input: { flex: 1, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 15px', color: '#fff', fontFamily: '"Roboto Mono", monospace', fontSize: '13px', outline: 'none' },
    sendBtn: { color: '#05060f', border: 'none', padding: '0 25px', fontWeight: '900', fontFamily: '"Roboto Mono", monospace', cursor: 'pointer', fontSize: '12px' },
    corner: { position: 'absolute', width: '15px', height: '15px', pointerEvents: 'none' }
};

export default InterviewSimulator;
