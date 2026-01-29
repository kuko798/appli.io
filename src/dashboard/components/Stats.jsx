
import React from 'react';

const Stats = ({ jobs = [], activeFilter = null, onFilterClick = () => { } }) => {
    const stats = {
        total: jobs.length,
        applied: jobs.filter(j => j.status === 'Applied').length,
        interview: jobs.filter(j => j.status === 'Interview').length,
        offer: jobs.filter(j => j.status === 'Offer').length,
        rejected: jobs.filter(j => j.status === 'Rejected').length
    };

    const cards = [
        { label: 'Total', count: stats.total, color: '#a78bfa', status: null },
        { label: 'Applied', count: stats.applied, color: '#60a5fa', status: 'Applied' },
        { label: 'Interview', count: stats.interview, color: '#fbbf24', status: 'Interview' },
        { label: 'Offer', count: stats.offer, color: '#34d399', status: 'Offer' },
        { label: 'Rejected', count: stats.rejected, color: '#f87171', status: 'Rejected' }
    ];

    return (
        <div style={styles.container}>
            {cards.map(card => (
                <StatCard
                    key={card.label}
                    {...card}
                    isActive={activeFilter === card.status}
                    onClick={() => onFilterClick(card.status)}
                />
            ))}
        </div>
    );
};

const StatCard = ({ label, count, color, isActive, onClick }) => (
    <div
        style={{
            ...styles.card,
            color: color,
            cursor: 'pointer',
            transform: isActive ? 'translateY(-8px) scale(1.02)' : 'translateY(0)',
            boxShadow: isActive
                ? `0 12px 40px ${color}40, inset 0 0 0 2px ${color}`
                : '0 4px 20px rgba(0, 0, 0, 0.2)',
            background: isActive
                ? `linear-gradient(135deg, ${color}20, ${color}10)`
                : 'rgba(255, 255, 255, 0.05)'
        }}
        onClick={onClick}
        onMouseEnter={(e) => {
            if (!isActive) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 30px ${color}30`;
            }
        }}
        onMouseLeave={(e) => {
            if (!isActive) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
            }
        }}
    >
        <div style={styles.count}>{count}</div>
        <div style={styles.label}>{label}</div>
    </div>
);

const styles = {
    container: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px',
        maxWidth: '1400px',
        margin: '0 auto 30px'
    },
    card: {
        padding: '30px',
        borderRadius: '20px',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
    },
    count: {
        fontSize: '48px',
        fontWeight: '700',
        marginBottom: '8px',
        textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
    },
    label: {
        fontSize: '12px',
        textTransform: 'uppercase',
        fontWeight: '700',
        letterSpacing: '1.5px',
        opacity: 0.9
    }
};

export default Stats;
