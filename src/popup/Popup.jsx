
import React, { useState } from 'react';

function Popup() {
    const [range, setRange] = useState("1m");
    const [status, setStatus] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = () => {
        setIsSyncing(true);
        setStatus("Syncing...");

        chrome.runtime.sendMessage({ action: "sync", range: range }, response => {
            setStatus(response);
            setIsSyncing(false);
        });
    };

    const openDashboard = () => {
        chrome.tabs.create({ url: "src/dashboard/index.html" });
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Appli.io</h2>

            <div style={styles.card}>
                <label style={styles.label}>Search Range</label>
                <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    style={styles.select}
                >
                    <option value="1m">Last 1 Month</option>
                    <option value="3m">Last 3 Months</option>
                    <option value="6m">Last 6 Months</option>
                    <option value="1y">Last 1 Year</option>
                </select>

                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    style={{ ...styles.buttonPrimary, opacity: isSyncing ? 0.7 : 1 }}
                >
                    {isSyncing ? "Syncing..." : "Sync Emails"}
                </button>
            </div>

            <button onClick={openDashboard} style={styles.buttonSecondary}>
                View Dashboard
            </button>

            {status && <div style={styles.status}>{status}</div>}
        </div>
    );
}

const styles = {
    container: {
        padding: '20px',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    header: {
        margin: '0 0 15px 0',
        color: '#333',
        fontWeight: '700'
    },
    card: {
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: '15px',
        width: '100%',
        boxSizing: 'border-box',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginBottom: '15px'
    },
    label: {
        fontSize: '12px',
        color: '#666',
        fontWeight: '600',
        marginBottom: '5px',
        display: 'block'
    },
    select: {
        width: '100%',
        marginBottom: '10px',
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid #ddd',
        background: '#fff',
        outline: 'none'
    },
    buttonPrimary: {
        width: '100%',
        padding: '10px',
        borderRadius: '6px',
        border: 'none',
        background: '#4285f4',
        color: 'white',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background 0.2s',
        boxShadow: '0 2px 4px rgba(66, 133, 244, 0.3)'
    },
    buttonSecondary: {
        width: '100%',
        padding: '10px',
        borderRadius: '6px',
        border: 'none',
        background: '#34a853',
        color: 'white',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(52, 168, 83, 0.3)'
    },
    status: {
        marginTop: '15px',
        fontSize: '13px',
        color: '#555',
        fontWeight: '500'
    }
};

export default Popup;
