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

    const openSettings = () => {
        chrome.runtime.openOptionsPage();
    };

    return (
        <div style={styles.container}>
            <div style={styles.headerContainer}>
                <h2 style={styles.header}>appli.io <span style={styles.v}>assistant</span></h2>
                <div style={styles.statusLine}>
                    <div style={{ ...styles.pulse, backgroundColor: isSyncing ? '#7c6ded' : '#10b981' }}></div>
                    {isSyncing ? 'Sync in progress' : 'Ready'}
                </div>
            </div>

            <div style={styles.card}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Sync window</label>
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        style={styles.select}
                    >
                        <option value="1m">Last 30 days</option>
                        <option value="3m">Last 90 days</option>
                        <option value="6m">Last 180 days</option>
                        <option value="1y">Last 1 year</option>
                    </select>
                </div>

                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    style={{ ...styles.buttonPrimary, opacity: isSyncing ? 0.6 : 1 }}
                    className="glitch-hover"
                >
                    {isSyncing ? "Syncing..." : "Sync Gmail"}
                </button>
            </div>

            <button
                onClick={openDashboard}
                style={styles.buttonSecondary}
                className="glitch-hover"
            >
                Open dashboard
            </button>

            <button
                onClick={openSettings}
                style={styles.buttonSecondary}
                className="glitch-hover"
            >
                Configure LLM
            </button>

            {status && (
                <div style={styles.status}>
                    {status}
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: '18px',
        background: 'linear-gradient(180deg, #090f1f 0%, #050814 100%)',
        minHeight: '220px',
        width: '300px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
    },
    headerContainer: {
        zIndex: 1,
        width: '100%',
        marginBottom: '14px',
        textAlign: 'left'
    },
    header: {
        margin: '0 0 5px 0',
        color: '#e6edf8',
        fontSize: '18px',
        fontWeight: '800',
        letterSpacing: '-0.3px',
        fontFamily: '"Inter", sans-serif'
    },
    v: {
        fontSize: '11px',
        opacity: 0.7,
        color: '#8ea1be'
    },
    statusLine: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: '#8ea1be',
        fontFamily: '"Inter", sans-serif',
        fontWeight: '500'
    },
    pulse: {
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        boxShadow: '0 0 10px currentColor'
    },
    card: {
        background: '#0d1424',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: '1px solid #1c2942',
        padding: '14px',
        width: '100%',
        boxSizing: 'border-box',
        zIndex: 1,
        marginBottom: '12px'
    },
    formGroup: {
        marginBottom: '12px'
    },
    label: {
        fontSize: '12px',
        color: '#8ea1be',
        fontWeight: '600',
        marginBottom: '6px',
        display: 'block',
        fontFamily: '"Inter", sans-serif'
    },
    select: {
        width: '100%',
        padding: '10px 11px',
        borderRadius: '8px',
        border: '1px solid #1c2942',
        background: '#111b30',
        color: '#e6edf8',
        outline: 'none',
        fontSize: '12px',
        fontFamily: '"Inter", sans-serif'
    },
    buttonPrimary: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #7c6ded',
        background: '#7c6ded',
        color: '#fff',
        fontWeight: '700',
        fontSize: '12px',
        fontFamily: '"Inter", sans-serif',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    buttonSecondary: {
        width: '100%',
        padding: '11px 12px',
        borderRadius: '8px',
        border: '1px solid #223352',
        background: 'transparent',
        color: '#a8b8d4',
        fontWeight: '600',
        fontSize: '12px',
        fontFamily: '"Inter", sans-serif',
        cursor: 'pointer',
        zIndex: 1,
        transition: 'all 0.2s',
        marginBottom: '8px'
    },
    status: {
        zIndex: 1,
        width: '100%',
        marginTop: '10px',
        fontSize: '11px',
        color: '#8ea1be',
        fontFamily: '"Inter", sans-serif',
        fontWeight: '500'
    }
};

export default Popup;
