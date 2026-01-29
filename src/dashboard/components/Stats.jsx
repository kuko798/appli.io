
import React, { useMemo } from 'react';

const Stats = ({ jobs = [], activeFilter = null, onFilterClick = () => { } }) => {
    const stats = useMemo(() => {
        const counts = { Applied: 0, Interview: 0, Offer: 0, Rejected: 0 };
        jobs.forEach(job => {
            if (counts[job.status] !== undefined) {
                counts[job.status]++;
            } else {
                counts.Applied++;
            }
        });
        return counts;
    }, [jobs]);

    return (
        <div style={styles.container}>
            <StatCard label="Applied" count={stats.Applied} color="#1a73e8" bg="#e8f0fe"
                isActive={activeFilter === "Applied"} onClick={() => onFilterClick("Applied")} />
            <StatCard label="Interview" count={stats.Interview} color="#f9ab00" bg="#fff8e1"
                isActive={activeFilter === "Interview"} onClick={() => onFilterClick("Interview")} />
            <StatCard label="Offer" count={stats.Offer} color="#137333" bg="#e6f4ea"
                isActive={activeFilter === "Offer"} onClick={() => onFilterClick("Offer")} />
            <StatCard label="Rejected" count={stats.Rejected} color="#c5221f" bg="#fce8e6"
                isActive={activeFilter === "Rejected"} onClick={() => onFilterClick("Rejected")} />
        </div>
    );
};

const StatCard = ({ label, count, color, bg, isActive, onClick }) => (
    <div
        style={{
            ...styles.card,
            background: bg,
            color: color,
            cursor: 'pointer',
            transform: isActive ? 'scale(1.05)' : 'scale(1)',
            boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.05)',
            border: isActive ? `2px solid ${color}` : '2px solid transparent'
        }}
        onClick={onClick}
    >
        <div style={styles.count}>{count}</div>
        <div style={styles.label}>{label}</div>
    </div>
);

const styles = {
    container: {
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    card: {
        padding: '20px',
        borderRadius: '12px',
        flex: '1',
        minWidth: '140px',
        textAlign: 'center',
        transition: 'all 0.2s ease'
    },
    count: {
        fontSize: '32px',
        fontWeight: '700',
        marginBottom: '5px'
    },
    label: {
        fontSize: '12px',
        textTransform: 'uppercase',
        fontWeight: '700',
        letterSpacing: '0.5px'
    }
};

export default Stats;
