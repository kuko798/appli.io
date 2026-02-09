import React, { useState } from 'react';

const ApiKeyOnboarding = ({ onComplete }) => {
    const [apiKey, setApiKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState('');

    const handleSave = () => {
        if (!apiKey.trim()) {
            setError('ACCESS_DENIED: KEY_NULL');
            return;
        }

        if (!apiKey.startsWith('gsk_')) {
            setError('INVALID_FORMAT: MUST_START_WITH_GSK');
            return;
        }

        setIsValidating(true);
        setError('');

        // Simulate validation delay for effect
        setTimeout(() => {
            chrome.storage.sync.set({ groqApiKey: apiKey.trim() }, () => {
                setIsValidating(false);
                if (onComplete) onComplete();
            });
        }, 800);
    };

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <div style={styles.iconContainer}>
                    <div style={styles.lockIcon}>🔒</div>
                    <div style={styles.scanLine}></div>
                </div>

                <h2 style={styles.title}>SECURITY CLEARANCE REQUIRED</h2>
                <p style={styles.description}>
                    This terminal requires a valid Groq API Key for operation.
                    Please input your credentials to initialize the Neural Engine.
                </p>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>ENTER_SECURITY_KEY:</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                            setApiKey(e.target.value);
                            setError('');
                        }}
                        placeholder="gsk_..."
                        style={styles.input}
                        spellCheck="false"
                    />
                </div>

                {error && <div style={styles.error}>⚠️ {error}</div>}

                <button
                    onClick={handleSave}
                    disabled={isValidating}
                    style={{
                        ...styles.button,
                        opacity: isValidating ? 0.7 : 1,
                        cursor: isValidating ? 'wait' : 'pointer'
                    }}
                >
                    {isValidating ? 'VERIFYING_CREDENTIALS...' : 'AUTHORIZE_ACCESS'}
                </button>

                <div style={styles.footer}>
                    Need a key? <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={styles.link}>Generate at Groq Console</a>
                </div>
            </div>

            <div style={styles.overlay}></div>
        </div>
    );
};

const styles = {
    container: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#050510',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: '"Roboto Mono", monospace',
        color: '#00f2ff'
    },
    content: {
        width: '90%',
        maxWidth: '400px',
        padding: '30px',
        background: 'rgba(10, 12, 30, 0.95)',
        border: '1px solid #00f2ff',
        borderRadius: '4px',
        boxShadow: '0 0 20px rgba(0, 242, 255, 0.2)',
        position: 'relative',
        zIndex: 2,
        textAlign: 'center'
    },
    iconContainer: {
        position: 'relative',
        width: '60px',
        height: '60px',
        margin: '0 auto 20px',
        border: '2px solid #00f2ff',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        overflow: 'hidden'
    },
    lockIcon: {
        filter: 'drop-shadow(0 0 5px #00f2ff)'
    },
    scanLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: '#00f2ff',
        animation: 'scan 2s infinite linear',
        boxShadow: '0 0 10px #00f2ff'
    },
    title: {
        fontSize: '16px',
        margin: '0 0 15px 0',
        letterSpacing: '2px',
        textShadow: '0 0 10px rgba(0, 242, 255, 0.5)'
    },
    description: {
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: '25px',
        lineHeight: '1.5'
    },
    inputGroup: {
        textAlign: 'left',
        marginBottom: '20px'
    },
    label: {
        display: 'block',
        fontSize: '10px',
        marginBottom: '8px',
        color: '#00f2ff',
        opacity: 0.8
    },
    input: {
        width: '100%',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(0, 242, 255, 0.3)',
        borderRadius: '2px',
        color: '#fff',
        fontFamily: '"Roboto Mono", monospace',
        fontSize: '14px',
        boxSizing: 'border-box',
        outline: 'none',
        transition: 'border 0.3s'
    },
    error: {
        color: '#ff0055',
        fontSize: '11px',
        marginBottom: '15px',
        textShadow: '0 0 5px rgba(255, 0, 85, 0.5)'
    },
    button: {
        width: '100%',
        padding: '14px',
        background: 'rgba(0, 242, 255, 0.15)',
        border: '1px solid #00f2ff',
        color: '#00f2ff',
        fontFamily: '"Roboto Mono", monospace',
        fontSize: '12px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        transition: 'all 0.3s',
        marginBottom: '20px'
    },
    footer: {
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.5)'
    },
    link: {
        color: '#00f2ff',
        textDecoration: 'none',
        borderBottom: '1px solid rgba(0, 242, 255, 0.3)'
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
            linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
            linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))
        `,
        backgroundSize: '100% 2px, 3px 100%',
        pointerEvents: 'none',
        zIndex: 1
    }
};

const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes scan {
    0% { top: 0; opacity: 0; }
    50% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
`;
document.head.appendChild(styleSheet);

export default ApiKeyOnboarding;
