
import React, { useState, useEffect, useRef } from 'react';

const InterviewSimulator = ({ job, mode = 'interview', onCancel }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [metrics, setMetrics] = useState({ fillerCount: 0, posture: 'Checking...', focus: 'Monitoring' });
    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const AVATAR_URL = "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=1000";
    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            recognition.onresult = (event) => {
                setInput(event.results[0][0].transcript);
                setIsListening(false);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }

        startSimulation();
        return () => {
            window.speechSynthesis.cancel();
            stopCamera();
        };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOn(false);
    };

    const toggleCamera = async () => {
        if (isCameraOn) {
            stopCamera();
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                    setIsCameraOn(true);
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                alert("CAMERA_ERROR: Permission denied or hardware not found.");
            }
        }
    };

    const speak = (text) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.rate = 1.05;
        utterance.pitch = 0.85;
        window.speechSynthesis.speak(utterance);
    };

    const toggleListening = () => {
        if (isListening) recognitionRef.current?.stop();
        else {
            setIsListening(true);
            recognitionRef.current?.start();
        }
    };

    const startSimulation = async () => {
        const content = `[VISUAL_LINK_PENDING] Initiating recruitment simulation for ${job.role} at ${job.company}.\n\nI am your CORE_AI lead. I am monitoring your vocal and visual signals for evaluation. State your readiness.`;
        setMessages([{ role: 'assistant', content }]);
        speak(content.replace(/\[.*?\]/g, ''));
    };

    const sendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = { role: 'user', content: input };
        const fillers = (input.match(/\b(um|uh|like|so|basically|actually)\b/gi) || []).length;
        setMetrics(prev => ({ ...prev, fillerCount: prev.fillerCount + fillers, posture: isCameraOn ? 'OPTIMAL' : 'OFFLINE' }));

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const apiKey = await new Promise((resolve) => {
                chrome.storage.sync.get(['groqApiKey'], (result) => resolve(result.groqApiKey));
            });

            const systemPrompt = `You are a realistic AI Interviewer. You have visual access to the candidate.
            CRITICAL: Mention something about their "visual signals" (eye contact, posture, engagement) based on whether their camera is on.
            Format reports in brackets like [METRIC_SYNC: Eye contact stable].
            Persona: Highly professional, direct, futuristic.`;

            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-6), userMsg],
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
            setMessages(prev => [...prev, { role: 'assistant', content: "[ERROR: SIGNAL_LOST]" }]);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* Real-time Visual Link HUD */}
                <div style={styles.visualRoom}>
                    <img src={AVATAR_URL} alt="Interviewer" style={{ ...styles.avatarImage, filter: isSpeaking ? 'brightness(1.2) contrast(1.1)' : 'brightness(0.9)' }} />
                    <div style={styles.avatarOverlay}></div>

                    {/* Camera Feed HUD */}
                    <div style={{ ...styles.cameraHUD, borderColor: isCameraOn ? '#00f2ff' : 'rgba(255,255,255,0.1)' }}>
                        {isCameraOn ? (
                            <video ref={videoRef} autoPlay muted style={styles.userVideo} />
                        ) : (
                            <div style={styles.cameraPlaceholder}>CAMERA_OFFLINE</div>
                        )}
                        <div style={styles.hudOverlay}>
                            <div style={styles.scannerLine}></div>
                            <div style={styles.hudCornerTR}></div>
                            <div style={styles.hudCornerBL}></div>
                        </div>
                    </div>

                    <div style={styles.roomStatus}>
                        <div style={{ ...styles.pulse, backgroundColor: '#00f2ff' }}></div>
                        SECURE_VISUAL_LINK_V4.0 // TARGET_LOCKED
                    </div>
                </div>

                <div style={styles.chatContainer}>
                    <div style={styles.messagesList}>
                        {messages.map((m, i) => (
                            <div key={i} style={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
                                <div style={styles.msgBadge}>{m.role === 'user' ? '> OPERATOR' : '> CORE_AI'}</div>
                                <div style={{ ...styles.msgContent, borderLeft: `2px solid ${m.role === 'user' ? '#ff0055' : '#00f2ff'}` }}>{m.content}</div>
                            </div>
                        ))}
                        {isTyping && <div style={styles.typingIndicator}>[AI_PROCESSING_VISUAL_INPUT...]</div>}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                <div style={styles.controlPanel}>
                    <div style={styles.metricsGroup}>
                        <span>POSTURE: {metrics.posture}</span>
                        <span>EYE_TRACK: {isCameraOn ? 'ACTIVE' : 'NAN'}</span>
                        <span>FILLERS: {metrics.fillerCount}</span>
                    </div>
                    <div style={styles.buttonGroup}>
                        <button onClick={toggleCamera} style={{ ...styles.panelBtn, color: isCameraOn ? '#00ff9d' : '#fff' }}>
                            {isCameraOn ? 'SYNC_CAMERA_ON' : 'INITIATE_CAMERA'}
                        </button>
                        <button onClick={toggleListening} style={{ ...styles.panelBtn, color: isListening ? '#ff0055' : '#fff' }}>
                            {isListening ? 'STOP_VOICE' : 'ENABLE_VOICE'}
                        </button>
                    </div>
                </div>

                <form onSubmit={sendMessage} style={styles.inputArea}>
                    <input autoFocus style={styles.input} placeholder={isListening ? "LISTENING..." : "ENTER COMMAND..."} value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} />
                    <button type="submit" style={styles.sendBtn} disabled={isTyping}>TRANSMIT</button>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 6, 15, 0.98)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(20px)' },
    modal: { width: '1000px', height: '90vh', background: '#0a0b1e', border: '1px solid rgba(0, 242, 255, 0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 100px rgba(0, 242, 255, 0.1)' },
    visualRoom: { height: '50%', background: '#000', position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.05)' },
    avatarImage: { width: '100%', height: '100%', objectFit: 'cover', transition: 'filter 0.5s ease' },
    avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 60%, #0a0b1e 100%)', pointerEvents: 'none' },
    cameraHUD: { position: 'absolute', top: '20px', right: '20px', width: '240px', height: '135px', background: '#000', border: '1px solid', overflow: 'hidden', borderRadius: '4px', zIndex: 10, boxShadow: '0 0 20px rgba(0,0,0,0.5)' },
    userVideo: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
    cameraPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' },
    hudOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
    scannerLine: { position: 'absolute', width: '100%', height: '2px', background: 'rgba(0, 242, 255, 0.4)', top: '0%', animation: 'scan 4s linear infinite' },
    hudCornerTR: { position: 'absolute', top: '10px', right: '10px', width: '20px', height: '20px', borderTop: '2px solid #00f2ff', borderRight: '2px solid #00f2ff' },
    hudCornerBL: { position: 'absolute', bottom: '10px', left: '10px', width: '20px', height: '20px', borderBottom: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' },
    roomStatus: { position: 'absolute', bottom: '20px', left: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: '#fff', fontFamily: '"Roboto Mono", monospace', letterSpacing: '2px', textShadow: '0 0 5px #000' },
    pulse: { width: '6px', height: '6px', borderRadius: '50%', animation: 'pulse-glow 1.5s infinite' },
    chatContainer: { flex: 1, padding: '20px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)' },
    messagesList: { display: 'flex', flexDirection: 'column', gap: '20px' },
    aiMsg: { alignSelf: 'flex-start', maxWidth: '80%' },
    userMsg: { alignSelf: 'flex-end', maxWidth: '80%', textAlign: 'right' },
    msgBadge: { fontSize: '9px', fontFamily: '"Roboto Mono", monospace', color: 'rgba(255,255,255,0.3)', marginBottom: '5px' },
    msgContent: { padding: '15px 20px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', color: '#eee', fontSize: '14px', border: '1px solid rgba(255,255,255,0.05)' },
    controlPanel: { padding: '15px 30px', background: 'rgba(0,0,0,0.5)', borderY: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    metricsGroup: { display: 'flex', gap: '20px', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: '"Roboto Mono", monospace' },
    buttonGroup: { display: 'flex', gap: '15px' },
    panelBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '4px', fontSize: '10px', fontFamily: '"Roboto Mono", monospace', cursor: 'pointer', transition: 'all 0.3s' },
    inputArea: { padding: '20px 30px', display: 'flex', gap: '15px', background: '#000' },
    input: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px', color: '#fff', outline: 'none', fontFamily: '"Roboto Mono", monospace' },
    sendBtn: { background: '#00f2ff', color: '#000', border: 'none', padding: '0 30px', fontWeight: '900', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' },
    typingIndicator: { fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: '#00f2ff', marginTop: '10px' }
};

export default InterviewSimulator;
