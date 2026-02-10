
import React, { useState, useEffect, useRef } from 'react';

const InterviewSimulator = ({ job, mode = 'interview', onCancel }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [metrics, setMetrics] = useState({ fillerCount: 0, paceAvg: 0, tone: 'Neutral' });
    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);

    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    useEffect(() => {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window) {
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                setInput(text);
                setIsListening(false);
            };

            recognition.onerror = () => setIsListening(false);
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }

        startSimulation();
        return () => window.speechSynthesis.cancel();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const speak = (text) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.rate = 1.1;
        utterance.pitch = 0.8; // Matrix/Tech voice
        window.speechSynthesis.speak(utterance);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setIsListening(true);
            recognitionRef.current?.start();
        }
    };

    const startSimulation = async () => {
        const content = mode === 'follow-up'
            ? `[SIGNAL_BOOSTER_INITIALIZED] Target lead at ${job.company} detected. I am ready to draft your follow-up comms. What angle should we take?`
            : `[COMMS_LINK_ESTABLISHED] Initiating recruitment simulation for ${job.role} at ${job.company}. I am your CORE_AI evaluator. State your readiness.`;

        setMessages([{ role: 'assistant', content }]);
        speak(content.replace(/\[.*?\]/g, ''));
    };

    const sendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = { role: 'user', content: input };

        // Basic Mannerism Check (Local)
        const fillers = (input.match(/\b(um|uh|like|so|basically|actually)\b/gi) || []).length;
        setMetrics(prev => ({ ...prev, fillerCount: prev.fillerCount + fillers }));

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

            const systemPrompt = `You are a high-tech AI Interviewer for a ${job.role} position at ${job.company}.
            CRITICAL: After the user speaks, briefly analyze their mannerisms (filler words, brevity, confidence) in brackets like [MANNERISM_REPORT: High confidence, low filler usage].
            Then ask ONE targeted technical or behavioral question.
            Persona: Futuristic, professional, Mission Control style.`;

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
            speak(aiText.replace(/\[.*?\]/g, ''));
        } catch (error) {
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'assistant', content: "[ERROR: SIGNAL_INTERRUPTED] Terminating link." }]);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <div style={styles.statusGroup}>
                        <div style={{ ...styles.pulse, backgroundColor: isSpeaking ? '#00f2ff' : (isListening ? '#ff0055' : '#00ff9d') }}></div>
                        <span style={styles.statusText}>
                            {isSpeaking ? 'VOICE_TRANSMISSION_ACTIVE' : (isListening ? 'LISTENING_MODE' : 'CORE_AI_IDLE')}
                        </span>
                    </div>
                    <button onClick={onCancel} style={styles.closeBtn}>TERMINATE_LINK</button>
                </div>

                <div style={styles.chatContainer}>
                    {/* Vocal Visualizer */}
                    <div style={styles.visualizer}>
                        {[...Array(20)].map((_, i) => (
                            <div key={i} style={{
                                ...styles.bar,
                                height: isSpeaking || isListening ? `${20 + Math.random() * 60}%` : '10%',
                                backgroundColor: isSpeaking ? '#00f2ff' : (isListening ? '#ff0055' : 'rgba(255,255,255,0.1)'),
                                transition: 'height 0.1s ease',
                                animation: isSpeaking || isListening ? 'bounce 0.2s infinite' : 'none'
                            }}></div>
                        ))}
                    </div>

                    <div style={styles.messagesList}>
                        {messages.map((m, i) => (
                            <div key={i} style={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
                                <div style={styles.msgBadge}>{m.role === 'user' ? '> OPERATOR' : '> CORE_AI'}</div>
                                <div style={{ ...styles.msgContent, borderLeft: `2px solid ${m.role === 'user' ? '#ff0055' : '#00f2ff'}` }}>{m.content}</div>
                            </div>
                        ))}
                        {isTyping && <div style={styles.typingIndicator}>[PROCESSING_NEURAL_SIGNAL...]</div>}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                <div style={styles.metricBar}>
                    METRICS // FILLERS_DETECTED: {metrics.fillerCount} // SIGNAL_QUALITY: PURE
                </div>

                <form onSubmit={sendMessage} style={styles.inputArea}>
                    <button
                        type="button"
                        onClick={toggleListening}
                        style={{ ...styles.voiceBtn, borderColor: isListening ? '#ff0055' : '#ffffff20' }}
                    >
                        {isListening ? "STOP_LISTENING" : "ENABLE_VOICE"}
                    </button>
                    <input
                        autoFocus
                        style={styles.input}
                        placeholder={isListening ? "LISTENING..." : "ENTER COMMAND..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isTyping}
                    />
                    <button type="submit" style={styles.sendBtn} disabled={isTyping}>TRANSMIT</button>
                </form>

                <div style={styles.scanline}></div>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 6, 15, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(15px)' },
    modal: { width: '800px', height: '85vh', background: 'rgba(15, 17, 34, 0.98)', border: '1px solid rgba(0, 242, 255, 0.2)', borderRadius: '4px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 0 100px rgba(0, 242, 255, 0.05)', overflow: 'hidden' },
    header: { padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' },
    statusGroup: { display: 'flex', alignItems: 'center', gap: '10px' },
    pulse: { width: '8px', height: '8px', borderRadius: '50%', boxShadow: '0 0 10px currentColor' },
    statusText: { fontSize: '10px', fontFamily: '"Roboto Mono", monospace', fontWeight: 'bold', color: '#fff', letterSpacing: '2px' },
    closeBtn: { background: 'transparent', border: '1px solid #ff0055', color: '#ff0055', padding: '6px 15px', fontSize: '10px', fontFamily: '"Roboto Mono", monospace', cursor: 'pointer', fontWeight: '900', transition: 'all 0.3s' },
    chatContainer: { flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px', overflowY: 'auto', position: 'relative' },
    visualizer: { position: 'sticky', top: 0, width: '100%', height: '40px', display: 'flex', alignItems: 'flex-end', gap: '4px', padding: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15, 17, 34, 0.98)', zIndex: 5 },
    bar: { flex: 1, minHeight: '4px', borderRadius: '2px' },
    messagesList: { display: 'flex', flexDirection: 'column', gap: '25px' },
    aiMsg: { alignSelf: 'flex-start', maxWidth: '80%' },
    userMsg: { alignSelf: 'flex-end', maxWidth: '80%', textAlign: 'right' },
    msgBadge: { fontSize: '9px', fontFamily: '"Roboto Mono", monospace', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '8px', fontWeight: 'bold' },
    msgContent: { padding: '20px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.03)', color: '#e0e0e0', fontSize: '14px', lineHeight: '1.7', border: '1px solid rgba(255,255,255,0.05)' },
    metricBar: { padding: '10px 30px', background: 'rgba(0,0,0,0.5)', borderY: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: '"Roboto Mono", monospace', letterSpacing: '1px' },
    inputArea: { padding: '30px', background: 'rgba(0,0,0,0.4)', display: 'flex', gap: '15px' },
    voiceBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid', padding: '0 20px', color: '#fff', fontSize: '10px', fontFamily: '"Roboto Mono", monospace', fontWeight: 'bold', cursor: 'pointer' },
    input: { flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '15px 20px', color: '#fff', fontFamily: '"Roboto Mono", monospace', fontSize: '14px', outline: 'none' },
    sendBtn: { background: '#00f2ff', color: '#000', border: 'none', padding: '0 30px', fontWeight: '900', fontFamily: '"Roboto Mono", monospace', cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase' },
    typingIndicator: { fontSize: '11px', fontFamily: '"Roboto Mono", monospace', color: '#00f2ff', opacity: 0.7 },
    scanline: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0, 242, 255, 0.02) 50%)', backgroundSize: '100% 4px', pointerEvents: 'none', opacity: 0.5 }
};

export default InterviewSimulator;
