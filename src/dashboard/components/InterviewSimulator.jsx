
import React, { useState, useEffect, useRef } from 'react';
import LocalLLM from '../../background/localLLM.js';

const RobotFace = ({ isSpeaking, isListening }) => {
    return (
        <svg
            width="500"
            height="500"
            viewBox="0 0 400 400"
            style={{
                filter: 'drop-shadow(0 0 40px rgba(0, 242, 255, 0.6))',
                transform: isListening ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 3s ease-in-out'
            }}
        >
            <defs>
                {/* Enhanced gradients */}
                <linearGradient id="headGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#1a2332', stopOpacity: 1 }} />
                    <stop offset="50%" style={{ stopColor: '#2d3748', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#1a1f2e', stopOpacity: 1 }} />
                </linearGradient>

                <linearGradient id="holoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#00f2ff', stopOpacity: 0.3 }} />
                    <stop offset="50%" style={{ stopColor: '#7000ff', stopOpacity: 0.2 }} />
                    <stop offset="100%" style={{ stopColor: '#00f2ff', stopOpacity: 0.3 }} />
                </linearGradient>

                {/* Enhanced glow filter */}
                <filter id="strongGlow">
                    <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                <filter id="innerGlow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                {/* Hexagon pattern */}
                <pattern id="hexPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <polygon points="10,2 17,6 17,14 10,18 3,14 3,6" fill="none" stroke="#00f2ff" strokeWidth="0.3" opacity="0.2" />
                </pattern>
            </defs>

            {/* Background glow effect */}
            <circle cx="200" cy="200" r="180" fill="url(#holoGradient)" opacity="0.15">
                <animate attributeName="r" values="180;190;180" dur="4s" repeatCount="indefinite" />
            </circle>

            {/* Main head with enhanced styling */}
            <rect
                x="80"
                y="60"
                width="240"
                height="280"
                rx="20"
                fill="url(#headGradient)"
                stroke="#00f2ff"
                strokeWidth="3"
                filter="url(#innerGlow)"
            />

            {/* Hexagon overlay */}
            <rect x="80" y="60" width="240" height="280" rx="20" fill="url(#hexPattern)" />

            {/* Holographic scan lines */}
            <rect x="90" y="70" width="220" height="2" fill="#00f2ff" opacity="0.4">
                <animate attributeName="y" values="70;320;70" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" repeatCount="indefinite" />
            </rect>

            {/* Corner accents */}
            <path d="M 90 70 L 110 70 L 110 72 L 92 72 L 92 90 L 90 90 Z" fill="#00f2ff" opacity="0.8" />
            <path d="M 310 70 L 290 70 L 290 72 L 308 72 L 308 90 L 310 90 Z" fill="#00f2ff" opacity="0.8" />
            <path d="M 90 330 L 110 330 L 110 328 L 92 328 L 92 310 L 90 310 Z" fill="#00f2ff" opacity="0.8" />
            <path d="M 310 330 L 290 330 L 290 328 L 308 328 L 308 310 L 310 310 Z" fill="#00f2ff" opacity="0.8" />

            {/* Antenna with enhanced glow */}
            <line x1="200" y1="60" x2="200" y2="25" stroke="#00f2ff" strokeWidth="4" filter="url(#strongGlow)" />
            <circle cx="200" cy="20" r="12" fill="#00f2ff" filter="url(#strongGlow)">
                <animate attributeName="r" values="12;15;12" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="200" cy="20" r="8" fill="#ffffff" opacity="0.8" />

            {/* Eyes with enhanced effects */}
            <circle cx="150" cy="140" r="30" fill="#00f2ff" opacity="0.3" filter="url(#strongGlow)">
                <animate attributeName="r" values="30;35;30" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="150" cy="140" r="25" fill="#00f2ff" filter="url(#strongGlow)">
                <animate attributeName="opacity" values="1;0.7;1" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="150" cy="140" r="15" fill="#ffffff" opacity="0.6" />
            <circle cx="150" cy="140" r="10" fill="#001a1a" />

            <circle cx="250" cy="140" r="30" fill="#00f2ff" opacity="0.3" filter="url(#strongGlow)">
                <animate attributeName="r" values="30;35;30" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="250" cy="140" r="25" fill="#00f2ff" filter="url(#strongGlow)">
                <animate attributeName="opacity" values="1;0.7;1" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="250" cy="140" r="15" fill="#ffffff" opacity="0.6" />
            <circle cx="250" cy="140" r="10" fill="#001a1a" />

            {/* Forehead display */}
            <rect x="140" y="95" width="120" height="30" rx="5" fill="#001a1a" stroke="#00f2ff" strokeWidth="2" opacity="0.8" />
            <text x="200" y="113" textAnchor="middle" fill="#00f2ff" fontSize="12" fontFamily="monospace" opacity="0.8">
                {isSpeaking ? '▮▮▮ ACTIVE' : '─── IDLE'}
            </text>

            {/* Cheek vents */}
            {[110, 290].map((x, i) => (
                <g key={i}>
                    <line x1={x} y1="180" x2={x} y2="220" stroke="#00f2ff" strokeWidth="2" opacity="0.4" />
                    <line x1={x + 8} y1="180" x2={x + 8} y2="220" stroke="#00f2ff" strokeWidth="2" opacity="0.4" />
                    <line x1={x + 16} y1="180" x2={x + 16} y2="220" stroke="#00f2ff" strokeWidth="2" opacity="0.4" />
                </g>
            ))}

            {/* Enhanced jaw */}
            <path
                d="M 130 240 L 270 240 L 260 260 L 140 260 Z"
                fill="#1a202c"
                stroke="#00f2ff"
                strokeWidth="3"
                filter="url(#innerGlow)"
            />

            <g
                style={{
                    transformOrigin: '200px 260px',
                    transform: isSpeaking ? 'rotate(8deg)' : 'rotate(0deg)',
                    transition: 'transform 0.1s ease-in-out'
                }}
            >
                <path
                    d="M 140 260 L 260 260 L 250 290 L 150 290 Z"
                    fill="#2d3748"
                    stroke="#00f2ff"
                    strokeWidth="3"
                    filter="url(#innerGlow)"
                />
                <rect x="160" y="262" width="12" height="10" fill="#00f2ff" opacity="0.3" />
                <rect x="185" y="262" width="12" height="10" fill="#00f2ff" opacity="0.3" />
                <rect x="210" y="262" width="12" height="10" fill="#00f2ff" opacity="0.3" />
                <rect x="235" y="262" width="12" height="10" fill="#00f2ff" opacity="0.3" />

                {/* Voice indicator */}
                {isSpeaking && (
                    <circle cx="200" cy="275" r="5" fill="#00f2ff" filter="url(#strongGlow)">
                        <animate attributeName="opacity" values="0.8;1;0.8" dur="0.15s" repeatCount="indefinite" />
                    </circle>
                )}
            </g>

            {isSpeaking && (
                <g>
                    <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values="0 200 260; 12 200 260; 0 200 260"
                        dur="0.15s"
                        repeatCount="indefinite"
                    />
                </g>
            )}

            {/* Side panels with detail */}
            <rect x="70" y="100" width="10" height="150" fill="#1a202c" stroke="#00f2ff" strokeWidth="2" rx="2" />
            <rect x="320" y="100" width="10" height="150" fill="#1a202c" stroke="#00f2ff" strokeWidth="2" rx="2" />

            {/* Panel indicators */}
            {[75, 325].map((x, i) => (
                <g key={i}>
                    <circle cx={x} cy="120" r="2" fill="#00f2ff">
                        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
                    </circle>
                    <circle cx={x} cy="145" r="2" fill="#00f2ff">
                        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin={`${i * 0.5 + 0.2}s`} />
                    </circle>
                    <circle cx={x} cy="170" r="2" fill="#00f2ff">
                        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin={`${i * 0.5 + 0.4}s`} />
                    </circle>
                </g>
            ))}
        </svg>
    );
};

const InterviewSimulator = ({ job, mode = 'interview', onCancel }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isNeuralLinkActive, setIsNeuralLinkActive] = useState(false);
    const [isManuallyStopped, setIsManuallyStopped] = useState(true);
    const [cameraError, setCameraError] = useState(null);
    const [metrics, setMetrics] = useState({ fillerCount: 0, posture: 'Scanning...', focus: 'Waiting' });
    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const AVATAR_URL = "https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&q=80&w=1000";

    useEffect(() => {
        // Initialize AI Subsystems
        if ('webkitSpeechRecognition' in window) {
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                // Trigger auto-send if it's a significant statement
                if (transcript.split(' ').length > 3) {
                    setTimeout(() => sendMessage(null, transcript), 1000);
                }
            };

            recognition.onend = () => {
                if (!isManuallyStopped) {
                    try { recognition.start(); } catch (e) { }
                } else {
                    setIsListening(false);
                }
            };

            recognition.onerror = () => setIsListening(false);
            recognitionRef.current = recognition;
        }

        // Initiation Sequence
        const timer = setTimeout(() => {
            setIsNeuralLinkActive(true);
            toggleListening(false); // Auto-start listening
        }, 1500);

        startSimulation();

        return () => {
            window.speechSynthesis.cancel();
            clearTimeout(timer);
        };
    }, [isManuallyStopped]); // Dependency on isManuallyStopped to handle loop restart correctly

    useEffect(() => {
        // Component Unmount Cleanup
        return () => {
            stopCamera();
            recognitionRef.current?.stop();
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
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraOn(false);
    };

    const toggleCamera = async () => {
        if (isCameraOn) {
            stopCamera();
        } else {
            try {
                setCameraError(null);
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                setIsCameraOn(true);
                setMetrics(prev => ({ ...prev, posture: 'OPTIMAL_SIGNAL' }));
            } catch (err) {
                console.error("Camera access failed:", err);
                setCameraError(err.name === 'NotAllowedError' ? 'PERMISSION_DENIED' : 'HARDWARE_ERROR');
                setIsCameraOn(false);
            }
        }
    };

    useEffect(() => {
        if (isCameraOn && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOn]);

    const speak = (text) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.rate = 1.05;
        utterance.pitch = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const toggleListening = (manual = true) => {
        if (manual) {
            const newState = !isManuallyStopped;
            setIsManuallyStopped(newState);
            if (newState) {
                recognitionRef.current?.stop();
                setIsListening(false);
            } else {
                setIsListening(true);
                try { recognitionRef.current?.start(); } catch (e) { }
            }
        } else {
            setIsManuallyStopped(false);
            setIsListening(true);
            try { recognitionRef.current?.start(); } catch (e) { }
        }
    };

    const startSimulation = async () => {
        const content = `[HUMANOID_LINK_ESTABLISHED] Pre-flight check complete. Visual and vocal assessment sensors are active.\n\nI am your CORE_AI evaluator. My algorithms are now monitoring your presence at ${job.company}. Prepare for the first evaluation objective.`;
        setMessages([{ role: 'assistant', content }]);
        speak(content.replace(/\[.*?\]/g, ''));
    };

    const sendMessage = async (e, directInput = null) => {
        if (e) e.preventDefault();
        const messageText = directInput || input;
        if (!messageText.trim() || isTyping) return;

        const userMsg = { role: 'user', content: messageText };
        const fillers = (messageText.match(/\b(um|uh|like|so|basically|actually)\b/gi) || []).length;
        setMetrics(prev => ({ ...prev, fillerCount: prev.fillerCount + fillers, focus: 'ANALYZING' }));

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const systemPrompt = `You are a high-fidelity Humanoid AI Interviewer.
You are "sitting" across from the user. You are visually and vocally linked.
CRITICAL: Comment on their "Neural Presence" (eye contact, posture, tone) based on live feedback.
Persona: Professional, perceptive, slightly intimidating but fair.
Include meta-tags like [EYE_TRACK: LOCKED] or [POSTURE_ANALYSIS: OPTIMAL] in your response.`;

            const aiText = await LocalLLM.generate({
                system: systemPrompt,
                messages: [...messages.slice(-6), userMsg],
                temperature: 0.7,
                maxTokens: 600
            });

            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
            speak(aiText.replace(/\[.*?\]/g, ''));
            setMetrics(prev => ({ ...prev, focus: 'WAITING' }));
        } catch (error) {
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'assistant', content: "[SIGNAL_LOST] Neural link failure. Re-establishing..." }]);
        }
    };

    return (
        <div style={styles.overlay}>
            <style>
                {`
                @keyframes humanoid-breath {
                    0%, 100% { transform: scale(1); filter: brightness(1); }
                    50% { transform: scale(1.015); filter: brightness(1.08); }
                }
                @keyframes humanoid-nod {
                    0%, 100% { transform: rotate(0deg); }
                    15%, 45% { transform: rotate(0.8deg); }
                    30%, 60% { transform: rotate(-0.8deg); }
                }
                @keyframes scanner-glow {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.8; }
                }
                @keyframes horizon-scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
                @keyframes mouth-pulse {
                    0%, 100% { transform: scaleX(1) scaleY(1); opacity: 0.3; }
                    50% { transform: scaleX(1.3) scaleY(2.5); opacity: 0.8; }
                }
                .digital-mouth {
                    position: absolute;
                    bottom: 28%;
                    width: 40px;
                    height: 4px;
                    background: #00f2ff;
                    border-radius: 20px;
                    box-shadow: 0 0 15px #00f2ff;
                    opacity: 0;
                    transition: all 0.3s;
                }
                .digital-mouth.speaking {
                    animation: mouth-pulse 0.15s ease-in-out infinite;
                    opacity: 1;
                }
                .humanoid-avatar {
                    animation: humanoid-breath 5s ease-in-out infinite;
                }
                `}
            </style>
            <div style={{ ...styles.modal, opacity: isNeuralLinkActive ? 1 : 0, transform: isNeuralLinkActive ? 'scale(1)' : 'scale(0.95)' }}>
                {/* Immersive Humanoid Room */}
                <div style={styles.visualRoom}>
                    <div style={styles.avatarContainer}>
                        <RobotFace isSpeaking={isSpeaking} isListening={isListening} />
                    </div>
                    <div style={styles.vignette}></div>

                    {/* Camera Feed Picture-in-Picture */}
                    <div style={{ ...styles.cameraHUD, borderColor: isCameraOn ? '#00f2ff' : (cameraError ? '#ff0055' : 'rgba(255,255,255,0.05)') }}>
                        {isCameraOn ? (
                            <video ref={videoRef} autoPlay muted style={styles.userVideo} />
                        ) : (
                            <div style={styles.cameraOff}>
                                <span style={{ color: cameraError ? '#ff0055' : '#444' }}>
                                    {cameraError || 'OPTICAL_LINK_OFFLINE'}
                                </span>
                            </div>
                        )}
                        <div style={styles.hudOverlay}>
                            <div style={styles.scanGrid}></div>
                            {isCameraOn && <div style={styles.trackingBox}></div>}
                            {isCameraOn && <div style={styles.scanLine}></div>}
                        </div>
                    </div>

                    <div style={styles.idBadge}>
                        <div style={styles.idCircle}></div>
                        ID: CORE_EVALUATOR_LINK_STABLE
                    </div>

                    <div style={styles.systemStatus}>
                        <div style={{ ...styles.heartbeat, backgroundColor: isListening ? '#00f2ff' : '#ff0055' }}></div>
                        ALIVE: {isListening ? 'CONSTANT_VOICE_LINK' : 'LINK_INTERRUPTED'}
                    </div>
                </div>

                <div style={styles.chatSection}>
                    <div style={styles.messagesList}>
                        {messages.map((m, i) => (
                            <div key={i} style={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
                                <div style={styles.msgHeader}>
                                    <span style={{ color: m.role === 'user' ? '#ff0055' : '#00f2ff' }}>{m.role === 'user' ? '> OPERATOR_SIGNAL' : '> HUMANOID_CORE'}</span>
                                </div>
                                <div style={{ ...styles.msgBubble, borderLeft: `3px solid ${m.role === 'user' ? '#ff0055' : '#00f2ff'}` }}>{m.content}</div>
                            </div>
                        ))}
                        {isTyping && <div style={styles.typing}>[CORE_AI_NEURAL_PROCESSING...]</div>}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                <div style={styles.infoBar}>
                    <div style={styles.metricItem}>
                        <span style={styles.metricLabel}>VOICE:</span>
                        <span style={{ ...styles.metricValue, color: isListening ? '#00f2ff' : '#ff0055' }}>{isListening ? 'CONTINUOUS' : 'MUTED'}</span>
                    </div>
                    <div style={styles.metricItem}>
                        <span style={styles.metricLabel}>ERRORS:</span>
                        <span style={styles.metricValue}>{metrics.fillerCount} FP_DETECTED</span>
                    </div>
                    <div style={styles.metricItem}>
                        <span style={styles.metricLabel}>POSE:</span>
                        <span style={styles.metricValue}>{metrics.posture}</span>
                    </div>
                </div>

                <div style={styles.footer}>
                    <div style={styles.controlsLeft}>
                        <button onClick={toggleCamera} style={{ ...styles.toolBtn, color: isCameraOn ? '#00f2ff' : '#666' }}>
                            {isCameraOn ? 'DISABLE_OPTICS' : 'INITIATE_OPTICS'}
                        </button>
                        <button onClick={() => toggleListening(true)} style={{ ...styles.toolBtn, color: !isManuallyStopped ? '#ff0055' : '#666' }}>
                            {!isManuallyStopped ? 'NEURAL_LINK_ON' : 'PETERMAN_LINK_OFF'}
                        </button>
                    </div>
                    <form onSubmit={sendMessage} style={styles.inputForm}>
                        <input autoFocus style={styles.input} placeholder={isListening ? "I AM LISTENING..." : "ENTER COMMAND..."} value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} />
                        <button type="submit" style={styles.sendBtn} disabled={isTyping}>TRANSMIT</button>
                    </form>
                    <button onClick={onCancel} style={styles.terminateBtn}>TERMINATE_LINK</button>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2, 3, 10, 0.99)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(30px)' },
    modal: { width: '1200px', height: '90vh', background: '#05060f', border: '1px solid rgba(0, 242, 255, 0.1)', borderRadius: '4px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 100px rgba(0, 242, 255, 0.05)', transition: 'all 0.5s' },
    visualRoom: { height: '55%', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarContainer: { position: 'relative', height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    avatarImage: { height: '100%', width: 'auto', objectFit: 'contain', transformOrigin: 'center' },
    vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle, transparent 40%, #05060f 120%)', pointerEvents: 'none' },
    cameraHUD: { position: 'absolute', bottom: '30px', right: '30px', width: '250px', height: '140px', background: '#000', border: '1px solid currentColor', borderRadius: '4px', overflow: 'hidden', zIndex: 10 },
    userVideo: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
    cameraOff: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '10px', fontFamily: '"Roboto Mono", monospace' },
    hudOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
    scanGrid: { width: '100%', height: '100%', background: 'linear-gradient(rgba(0, 242, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 255, 0.05) 1px, transparent 1px)', backgroundSize: '30px 30px' },
    trackingBox: { position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', border: '1px solid rgba(0, 242, 255, 0.2)', animation: 'scanner-glow 3s infinite' },
    scanLine: { position: 'absolute', width: '100%', height: '1px', background: 'rgba(0, 242, 255, 0.5)', top: '0', animation: 'horizon-scan 4s linear infinite' },
    idBadge: { position: 'absolute', top: '30px', left: '30px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontFamily: '"Roboto Mono", monospace' },
    idCircle: { width: '6px', height: '6px', borderRadius: '50%', background: '#00f2ff' },
    systemStatus: { position: 'absolute', bottom: '30px', left: '30px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: '#fff', fontFamily: '"Roboto Mono", monospace', letterSpacing: '2px' },
    heartbeat: { width: '6px', height: '6px', borderRadius: '50%', boxShadow: '0 0 10px currentColor' },
    chatSection: { flex: 1, padding: '30px', overflowY: 'auto' },
    messagesList: { display: 'flex', flexDirection: 'column', gap: '30px' },
    aiMsg: { alignSelf: 'flex-start', maxWidth: '75%' },
    userMsg: { alignSelf: 'flex-end', maxWidth: '75%', textAlign: 'right' },
    msgHeader: { fontSize: '9px', fontFamily: '"Roboto Mono", monospace', marginBottom: '8px', fontWeight: 'bold' },
    msgBubble: { padding: '15px 20px', background: 'rgba(255,255,255,0.02)', color: '#ccc', borderRadius: '2px', fontSize: '14px', lineHeight: '1.6', border: '1px solid rgba(255,255,255,0.03)' },
    typing: { fontSize: '10px', color: '#00f2ff', fontFamily: '"Roboto Mono", monospace' },
    infoBar: { padding: '12px 30px', background: 'rgba(0,0,0,0.3)', display: 'flex', gap: '40px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' },
    metricItem: { display: 'flex', gap: '8px', fontSize: '9px', fontFamily: '"Roboto Mono", monospace' },
    metricLabel: { color: 'rgba(255,255,255,0.3)' },
    metricValue: { color: '#fff', fontWeight: 'bold' },
    footer: { padding: '25px 30px', display: 'flex', gap: '20px', background: '#000' },
    controlsLeft: { display: 'flex', gap: '10px' },
    toolBtn: { background: 'transparent', border: '1px solid currentColor', padding: '10px 15px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace', transition: 'all 0.3s' },
    inputForm: { flex: 1, display: 'flex', gap: '10px' },
    input: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px', color: '#fff', fontFamily: '"Roboto Mono", monospace', borderRadius: '4px', outline: 'none' },
    sendBtn: { background: '#00f2ff', color: '#000', border: 'none', padding: '0 25px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' },
    terminateBtn: { background: 'transparent', border: '1px solid #ff0055', color: '#ff0055', padding: '10px 20px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }
};

export default InterviewSimulator;
