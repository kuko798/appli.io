
import React from 'react';

const Stats = ({ jobs = [], activeFilter = null, onFilterClick = () => { }, onHover = () => { } }) => {
    const stats = {
        total: jobs.length,
        applied: jobs.filter(j => j.status === 'Applied').length,
        interview: jobs.filter(j => j.status === 'Interview').length,
        offer: jobs.filter(j => j.status === 'Offer').length,
        rejected: jobs.filter(j => j.status === 'Rejected').length
    };

    const cards = [
        { label: 'DATA_TOTAL', count: stats.total, color: '#a78bfa', status: null },
        { label: 'STATUS_APPLIED', count: stats.applied, color: '#60a5fa', status: 'Applied' },
        { label: 'STATUS_INTERVIEW', count: stats.interview, color: '#fbbf24', status: 'Interview' },
        { label: 'STATUS_OFFER', count: stats.offer, color: '#00ff9d', status: 'Offer' },
        { label: 'STATUS_REJECTED', count: stats.rejected, color: '#ff0055', status: 'Rejected' }
    ];

    return (
        <div style={styles.container}>
            {cards.map(card => (
                <StatCard
                    key={card.label}
                    {...card}
                    isActive={activeFilter === card.status}
                    onClick={() => onFilterClick(card.status)}
                    onMouseEnter={() => onHover(card.status)}
                    onMouseLeave={() => onHover(null)}
                />
            ))}
        </div>
    );
};

const StatCard = ({ label, count, color, isActive, onClick, onMouseEnter, onMouseLeave }) => (
    <div
        style={{
            ...styles.card,
            cursor: 'pointer',
            border: `1px solid ${isActive ? color : 'rgba(255, 255, 255, 0.1)'}`,
            boxShadow: isActive ? `0 0 20px ${color}30, inset 0 0 10px ${color}10` : 'none',
            background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)'
        }}
        onClick={onClick}
        onMouseEnter={(e) => {
            onMouseEnter();
            if (!isActive) {
                e.currentTarget.style.border = `1px solid ${color}80`;
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.boxShadow = `0 0 15px ${color}20`;
            }
            const scanLine = e.currentTarget.querySelector('.scan-line');
            if (scanLine) scanLine.style.display = 'block';
        }}
        onMouseLeave={(e) => {
            onMouseLeave();
            if (!isActive) {
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.boxShadow = 'none';
            }
            const scanLine = e.currentTarget.querySelector('.scan-line');
            if (scanLine) scanLine.style.display = 'none';
        }}
    >
        <div style={styles.corners}>
            <div style={{ ...styles.corner, top: -1, left: -1, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }}></div>
            <div style={{ ...styles.corner, bottom: -1, right: -1, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }}></div>
        </div>
        <div className="scan-line" style={{ ...styles.statScan, background: `linear-gradient(to bottom, transparent, ${color}, transparent)` }}></div>
        <div style={{ ...styles.count, color: color }}>{count.toString().padStart(2, '0')}</div>
        <div style={styles.label}>{label}</div>
    </div>
);

const styles = {
    container: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        maxWidth: '1400px',
        margin: '0 auto 40px',
        position: 'relative',
        zIndex: 2
    },
    card: {
        padding: '35px 25px',
        borderRadius: '4px',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden'
    },
    statScan: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        opacity: 0.5,
        zIndex: 3,
        display: 'none',
        pointerEvents: 'none',
        animation: 'scan 2s linear infinite'
    },
    corners: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none'
    },
    corner: {
        position: 'absolute',
        width: '10px',
        height: '10px'
    },
    count: {
        fontSize: '56px',
        fontWeight: '900',
        marginBottom: '10px',
        fontFamily: '"Roboto Mono", monospace',
        letterSpacing: '-2px',
        textShadow: '0 0 15px currentColor'
    },
    label: {
        fontSize: '11px',
        textTransform: 'uppercase',
        fontWeight: '800',
        letterSpacing: '2px',
        opacity: 0.7,
        fontFamily: '"Roboto Mono", monospace',
        color: '#fff'
    }
};

export default Stats;
