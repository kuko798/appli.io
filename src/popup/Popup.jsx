import React, { useState } from 'react';

const Popup = () => {
    const [range, setRange] = useState("1m");
    const [status, setStatus] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = () => {
        setIsSyncing(true);
        setStatus("INITIALIZING_SYNC...");

        chrome.runtime.sendMessage({ action: "sync", range: range }, response => {
            setStatus("TERMINAL: " + response);
            setIsSyncing(false);
        });
    };

    const openDashboard = () => {
        chrome.tabs.create({ url: "src/dashboard/index.html" });
    };

    return (
        <div style={styles.container}>
            <div style={styles.grid}></div>
            <div style={styles.headerContainer}>
                <h2 style={styles.header}>APPLI.IO <span style={styles.v}>v1.0</span></h2>
                <div style={styles.statusLine}>
                    <div style={{ ...styles.pulse, backgroundColor: isSyncing ? '#00f2ff' : '#00ff9d' }}></div>
                    {isSyncing ? 'SYNC_ACTIVE' : 'SYSTEM_READY'}
                </div>
            </div>

            <div style={styles.card}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>TIME_WINDOW_RANGE</label>
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        style={styles.select}
                    >
                        <option value="1m">RANGE_30D</option>
                        <option value="3m">RANGE_90D</option>
                        <option value="6m">RANGE_180D</option>
                        <option value="1y">RANGE_365D</option>
                    </select>
                </div>

                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    style={{ ...styles.buttonPrimary, opacity: isSyncing ? 0.6 : 1 }}
                    className="glitch-hover"
                >
                    {isSyncing ? "SYNC_PENDING..." : "EXECUTE_SYNC"}
                </button>
            </div>

            <button
                onClick={openDashboard}
                style={styles.buttonSecondary}
                className="glitch-hover"
            >
                OPEN_DASHBOARD_CMD
            </button>

            {status && (
                <div style={styles.status}>
                    <span style={styles.cursor}>&gt;</span> {status}
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: '25px',
        backgroundColor: '#0a0b1e',
        background: 'radial-gradient(circle at 50% 50%, #1a1b3a 0%, #0a0b1e 100%)',
        minHeight: '220px',
        width: '300px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
    },
    grid: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `linear-gradient(rgba(0, 242, 255, 0.05) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(0, 242, 255, 0.05) 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        pointerEvents: 'none',
        zIndex: 0
    },
    headerContainer: {
        zIndex: 1,
        width: '100%',
        marginBottom: '20px',
        textAlign: 'left'
    },
    header: {
        margin: '0 0 5px 0',
        color: '#00f2ff',
        fontSize: '18px',
        fontWeight: '900',
        letterSpacing: '1px',
        fontFamily: '"Inter", sans-serif'
    },
    v: {
        fontSize: '10px',
        opacity: 0.6
    },
    statusLine: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '9px',
        color: '#e0e0e0',
        fontFamily: '"Roboto Mono", monospace',
        fontWeight: '700'
    },
    pulse: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        boxShadow: '0 0 8px currentColor'
    },
    card: {
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        borderRadius: '2px',
        border: '1px solid rgba(0, 242, 255, 0.2)',
        padding: '15px',
        width: '100%',
        boxSizing: 'border-box',
        zIndex: 1,
        marginBottom: '15px'
    },
    formGroup: {
        marginBottom: '15px'
    },
    label: {
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '800',
        marginBottom: '8px',
        display: 'block',
        fontFamily: '"Roboto Mono", monospace'
    },
    select: {
        width: '100%',
        padding: '10px',
        borderRadius: '2px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        outline: 'none',
        fontSize: '12px',
        fontFamily: '"Inter", sans-serif'
    },
    buttonPrimary: {
        width: '100%',
        padding: '12px',
        borderRadius: '2px',
        border: '1px solid #00f2ff',
        background: 'rgba(0, 242, 255, 0.1)',
        color: '#00f2ff',
        fontWeight: '900',
        fontSize: '11px',
        fontFamily: '"Roboto Mono", monospace',
        cursor: 'pointer',
        transition: 'all 0.3s',
        boxShadow: '0 0 10px rgba(0, 242, 255, 0.1)',
        textTransform: 'uppercase'
    },
    buttonSecondary: {
        width: '100%',
        padding: '12px',
        borderRadius: '2px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        background: 'transparent',
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '800',
        fontSize: '11px',
        fontFamily: '"Roboto Mono", monospace',
        cursor: 'pointer',
        zIndex: 1,
        transition: 'all 0.3s'
    },
    status: {
        zIndex: 1,
        width: '100%',
        marginTop: '15px',
        fontSize: '10px',
        color: '#00ff9d',
        fontFamily: '"Roboto Mono", monospace',
        fontWeight: '600'
    },
    cursor: {
        animation: 'blink 1s step-end infinite'
    }
};

export default Popup;
