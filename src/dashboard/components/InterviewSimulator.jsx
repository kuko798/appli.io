import React, { useState, useEffect, useRef } from 'react';
import LocalLLM from '../../background/localLLM.js';
import { useMediaQuery } from '../utils/useMediaQuery.js';

const BRAND = '#8e5be8';

export default function InterviewSimulator({ job, mode = 'interview', onCancel }) {
    const isNarrow = useMediaQuery('(max-width: 720px)');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [fillerCount, setFillerCount] = useState(0);
    const [started, setStarted] = useState(false);
    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const listeningRef = useRef(false);

    const isFollowUp = mode === 'follow-up';
    const title = isFollowUp ? 'Follow-up Generator' : 'Interview Prep';
    const subtitle = isFollowUp ? `${job.company} · Generate a follow-up email` : `${job.company} · ${job.title || 'Practice session'}`;

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const rec = new window.webkitSpeechRecognition();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = 'en-US';
            rec.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                if (transcript.split(' ').length > 3) {
                    setTimeout(() => sendMessage(null, transcript), 800);
                }
            };
            rec.onend = () => {
                if (listeningRef.current) {
                    try { rec.start(); } catch (e) { }
                } else {
                    setIsListening(false);
                }
            };
            rec.onerror = () => setIsListening(false);
            recognitionRef.current = rec;
        }
        return () => {
            window.speechSynthesis.cancel();
            stopCamera();
            recognitionRef.current?.stop();
        };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isCameraOn && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOn]);

    const startSession = async () => {
        setStarted(true);
        const openingText = isFollowUp
            ? `Hi! I'll help you write a follow-up email for your application to ${job.company}. Tell me — how long ago did you apply, and is there anything specific you'd like to highlight?`
            : `Welcome! I'll be your practice interviewer for the ${job.title || 'position'} role at ${job.company}. Let's start simple — can you walk me through your background and why you're interested in this role?`;
        setMessages([{ role: 'assistant', content: openingText }]);
        speak(openingText);
    };

    const speak = (text) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    const toggleListening = () => {
        if (isListening) {
            listeningRef.current = false;
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            listeningRef.current = true;
            setIsListening(true);
            try { recognitionRef.current?.start(); } catch (e) { }
        }
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
            } catch (err) {
                setCameraError(err.name === 'NotAllowedError' ? 'Camera access denied' : 'Camera unavailable');
            }
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsCameraOn(false);
    };

    const sendMessage = async (e, directInput = null) => {
        if (e) e.preventDefault();
        const text = directInput || input;
        if (!text.trim() || isTyping) return;

        const fillers = (text.match(/\b(um|uh|like|so|basically|actually)\b/gi) || []).length;
        setFillerCount(prev => prev + fillers);
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const systemPrompt = isFollowUp
                ? `You are a professional career coach helping write follow-up emails. The user applied to ${job.company} for a ${job.title || 'position'} role. Help them craft a concise, professional follow-up email. Keep responses conversational and ask clarifying questions as needed.`
                : `You are a professional interviewer at ${job.company} interviewing a candidate for the ${job.title || 'open'} position. Ask thoughtful, relevant questions. Give brief, constructive feedback after each answer. Keep a professional but approachable tone. Don't use special characters or formatting tags.`;

            const aiText = await LocalLLM.generate({
                system: systemPrompt,
                messages: [...messages.slice(-8), userMsg],
                temperature: 0.7,
                maxTokens: 500
            });

            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
            speak(aiText);
        } catch {
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Connection issue — make sure your LLM is running and try again.' }]);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(244,247,251,0.76)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: isNarrow ? 'flex-end' : 'center', justifyContent: 'center',
            padding: isNarrow ? '0' : '16px',
            paddingBottom: isNarrow ? 'env(safe-area-inset-bottom, 0px)' : '16px',
        }}>
            <div style={{
                width: isNarrow ? '100%' : 860,
                maxWidth: isNarrow ? '100%' : 860,
                height: isNarrow ? 'min(92dvh, 100%)' : '88vh',
                maxHeight: isNarrow ? 'min(92dvh, 100% - env(safe-area-inset-top))' : '88vh',
                background: '#ffffff',
                border: isNarrow ? 'none' : '1px solid #d7e0ec',
                borderRadius: isNarrow ? '16px 16px 0 0' : 16,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: isNarrow ? '0 -12px 48px rgba(15,23,40,0.12)' : '0 20px 60px rgba(15,23,40,0.14)',
                position: 'relative',
            }}>
                {/* Header */}
                <div style={{
                    padding: isNarrow ? '14px 16px' : '16px 24px', borderBottom: '1px solid #d7e0ec',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    flexShrink: 0, gap: 12, flexWrap: 'wrap'
                }}>
                    <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                        <div style={{ fontSize: isNarrow ? 14 : 15, fontWeight: 700, color: '#0f1728' }}>{title}</div>
                        <div style={{ fontSize: 12, color: '#6f8299', marginTop: 2, wordBreak: 'break-word' }}>{subtitle}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {started && (
                            <>
                                {fillerCount > 0 && (
                                    <div style={{
                                        fontSize: 12, color: '#f59e0b',
                                        background: '#f59e0b18', border: '1px solid #f59e0b30',
                                        padding: '4px 10px', borderRadius: 6
                                    }}>
                                        {fillerCount} filler word{fillerCount !== 1 ? 's' : ''}
                                    </div>
                                )}
                                {!isFollowUp && (
                                    <button onClick={toggleCamera} style={{
                                        background: isCameraOn ? '#8e5be815' : '#ffffff',
                                        border: `1px solid ${isCameraOn ? BRAND : '#d7e0ec'}`,
                                        color: isCameraOn ? BRAND : '#6a5f7e',
                                        padding: '6px 14px', borderRadius: 7,
                                        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                                    }}>
                                        {isCameraOn ? '📷 On' : '📷 Camera'}
                                    </button>
                                )}
                                <button onClick={toggleListening} style={{
                                    background: isListening ? '#f8717120' : 'transparent',
                                    border: `1px solid ${isListening ? '#f87171' : '#d7e0ec'}`,
                                    color: isListening ? '#f87171' : '#6a5f7e',
                                    padding: '6px 14px', borderRadius: 7,
                                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                                }}>
                                    {isListening ? '🎤 Listening' : '🎤 Mic'}
                                </button>
                            </>
                        )}
                        <button onClick={onCancel} style={{
                            background: '#ffffff', border: '1px solid #d7e0ec',
                            color: '#6a5f7e', padding: '6px 14px', borderRadius: 7,
                            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                        }}>Close</button>
                    </div>
                </div>

                {/* Camera pip */}
                {isCameraOn && (
                    <div style={{
                        position: 'absolute', bottom: isNarrow ? 100 : 90, right: isNarrow ? 12 : 32,
                        width: isNarrow ? 160 : 200, height: isNarrow ? 90 : 112, borderRadius: 10,
                        overflow: 'hidden', border: '1px solid #d7e0ec',
                        background: '#f8fbff', zIndex: 10
                    }}>
                        <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    </div>
                )}
                {cameraError && (
                    <div style={{
                        position: 'absolute', bottom: isNarrow ? 100 : 90, right: isNarrow ? 12 : 32,
                        background: '#ffffff', border: '1px solid #d7e0ec',
                        borderRadius: 10, padding: '12px 16px', fontSize: 12,
                        color: '#f87171', zIndex: 10
                    }}>{cameraError}</div>
                )}

                {/* Messages */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: isNarrow ? '16px 14px' : '24px 28px',
                    display: 'flex', flexDirection: 'column', gap: 16, WebkitOverflowScrolling: 'touch',
                }}>
                    {!started ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
                            <div style={{ fontSize: 36 }}>{isFollowUp ? '✉️' : '🎤'}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f1728' }}>
                                {isFollowUp ? 'Write a follow-up for ' : 'Practice interview for '}{job.company}
                            </div>
                            <div style={{ fontSize: 14, color: '#5b708a', maxWidth: 380 }}>
                                {isFollowUp
                                    ? 'Answer a few questions and get a polished follow-up email you can send today.'
                                    : 'An AI interviewer will ask real questions for this role. You can speak or type your answers.'}
                            </div>
                            <button onClick={startSession} style={{
                                background: BRAND, color: '#fff', border: 'none',
                                padding: '12px 32px', borderRadius: 10,
                                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                marginTop: 8
                            }}>Start session</button>
                        </div>
                    ) : (
                        <>
                            {messages.map((m, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
                                }}>
                                    <div style={{
                                        maxWidth: isNarrow ? '92%' : '72%',
                                        background: m.role === 'user' ? '#f3eaff' : '#f8f7fc',
                                        border: `1px solid ${m.role === 'user' ? '#bad0ff' : '#d7e0ec'}`,
                                        borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                        padding: '12px 16px',
                                        fontSize: 14, color: '#21354d', lineHeight: 1.65
                                    }}>
                                        {m.role === 'assistant' && (
                                            <div style={{ fontSize: 11, fontWeight: 600, color: '#6f8299', marginBottom: 6 }}>
                                                {isFollowUp ? 'Assistant' : 'Interviewer'}
                                            </div>
                                        )}
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div style={{ display: 'flex', gap: 5, padding: '12px 16px', alignItems: 'center' }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{
                                            width: 6, height: 6, borderRadius: '50%', background: '#6f8299',
                                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                                        }} />
                                    ))}
                                </div>
                            )}
                            {isSpeaking && (
                                <div style={{ fontSize: 11, color: '#6f8299', paddingLeft: 4 }}>Speaking…</div>
                            )}
                            <div ref={chatEndRef} />
                        </>
                    )}
                </div>

                {/* Input */}
                {started && (
                    <div style={{
                        padding: isNarrow ? '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))' : '16px 24px',
                        borderTop: '1px solid #d7e0ec',
                        flexShrink: 0
                    }}>
                        <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10, flexDirection: isNarrow ? 'column' : 'row' }}>
                            <input
                                autoFocus
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder={isListening ? 'Listening… speak your answer' : 'Type your response…'}
                                disabled={isTyping}
                                style={{
                                    flex: 1, background: '#ffffff', border: '1px solid #d7e0ec',
                                    borderRadius: 10, color: '#0f1728', padding: isNarrow ? '12px 14px' : '11px 16px',
                                    fontSize: isNarrow ? 16 : 14, outline: 'none', fontFamily: 'inherit',
                                    opacity: isTyping ? 0.6 : 1, width: isNarrow ? '100%' : 'auto', boxSizing: 'border-box',
                                }}
                                onFocus={e => e.target.style.borderColor = BRAND}
                                onBlur={e => e.target.style.borderColor = '#d7e0ec'}
                            />
                            <button type="submit" disabled={isTyping || !input.trim()} style={{
                                background: BRAND, color: '#fff', border: 'none',
                                padding: isNarrow ? '12px 22px' : '11px 22px', borderRadius: 10,
                                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'inherit', opacity: (isTyping || !input.trim()) ? 0.5 : 1,
                                width: isNarrow ? '100%' : 'auto', minHeight: isNarrow ? 48 : undefined,
                            }}>Send</button>
                        </form>
                    </div>
                )}

                <style>{`
                    @keyframes bounce {
                        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                        40% { transform: translateY(-6px); opacity: 1; }
                    }
                `}</style>
            </div>
        </div>
    );
}
