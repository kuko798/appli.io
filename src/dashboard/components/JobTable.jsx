
import React, { useState, useMemo } from 'react';

const ITEMS_PER_PAGE = 20;

const JobTable = ({ jobs = [], activeFilter = null, onUpdateJob = () => { }, onDeleteJob = () => { }, onSimulateJob = () => { }, onDeepScan = () => { } }) => {
    const [currentPage, setCurrentPage] = useState(1);

    const filteredAndSortedJobs = useMemo(() => {
        let filtered = activeFilter
            ? jobs.filter(job => job.status === activeFilter)
            : jobs;
        return [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [jobs, activeFilter]);

    const totalPages = Math.ceil(filteredAndSortedJobs.length / ITEMS_PER_PAGE);
    const currentJobs = filteredAndSortedJobs.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handlePrev = () => setCurrentPage(p => Math.max(1, p - 1));
    const handleNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));

    const handleStatusChange = (jobId, newStatus) => {
        onUpdateJob(jobId, { status: newStatus });
    };

    const isJobCold = (date) => {
        const lastDate = new Date(date);
        const now = new Date();
        const diff = (now - lastDate) / (1000 * 60 * 60 * 24);
        return diff > 10;
    };

    if (jobs.length === 0) {
        return (
            <div style={styles.empty}>
                <div style={styles.emptyGlitch}>NO_DATA_DETECTED</div>
                <div style={styles.emptySub}>SYNC_REQUIRED_FOR_INITIALIZATION</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.tableHeader}>
                <div style={styles.headerLabel}>ACTIVE_DATA_FEED</div>
                <div style={styles.headerDecoration}></div>
            </div>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>COMPANY_NAME</th>
                        <th style={styles.th}>ASSIGNED_ROLE</th>
                        <th style={styles.th}>DATA_SUBJECT</th>
                        <th style={styles.th}>NODE_STATUS</th>
                        <th style={styles.th}>TIMESTAMP</th>
                        <th style={styles.th}>CMD</th>
                    </tr>
                </thead>
                <tbody>
                    {currentJobs.map((job) => {
                        const cold = isJobCold(job.date);
                        const canTrain = job.status === 'Interview';
                        const showSimBtn = cold || canTrain;

                        return (
                            <tr
                                key={job.id}
                                style={{ ...styles.tr, borderLeft: cold ? '4px solid #ff0055' : '1px solid transparent' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 242, 255, 0.08)';
                                    e.currentTarget.style.transform = 'scale(1.005) translateX(5px)';
                                    e.currentTarget.style.boxShadow = cold ? '0 0 15px rgba(255,0,85,0.3)' : 'inset 4px 0 0 #00f2ff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.transform = 'scale(1) translateX(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <td style={styles.td}>{job.company || 'UNKNOWN'}</td>
                                <td style={{ ...styles.td, fontWeight: '700', color: '#00f2ff' }}>{job.title || 'NULL'}</td>
                                <td style={{ ...styles.td, opacity: 0.6 }}>{job.subject}</td>
                                <td style={styles.td}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <select
                                            value={job.status}
                                            onChange={(e) => handleStatusChange(job.id, e.target.value)}
                                            style={getStatusSelectStyle(job.status)}
                                        >
                                            <option value="Applied">APPLIED</option>
                                            <option value="Interview">INTERVIEW</option>
                                            <option value="Offer">OFFER</option>
                                            <option value="Rejected">REJECTED</option>
                                        </select>
                                        {cold && (
                                            <div style={styles.coldIndicator} title="SIGNAL_LOST: Lead has gone cold (10+ days)">!</div>
                                        )}
                                    </div>
                                </td>
                                <td style={{ ...styles.td, fontFamily: '"Roboto Mono", monospace', fontSize: '12px' }}>
                                    {new Date(job.date).toLocaleDateString(undefined, { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')}
                                </td>
                                <td style={styles.td}>
                                    <div style={styles.cmdGroup}>
                                        <button
                                            onClick={() => onDeepScan(job)}
                                            style={styles.intelBtn}
                                            title="DEEP_SCAN_TARGET"
                                        >
                                            INTEL
                                        </button>
                                        {showSimBtn && (
                                            <button
                                                onClick={() => onSimulateJob(job, cold ? 'follow-up' : 'interview')}
                                                style={{ ...styles.simBtn, borderColor: cold ? '#ff0055' : '#00f2ff', color: cold ? '#ff0055' : '#00f2ff' }}
                                                title={cold ? "GENERATE_SIGNAL_BOOSTER" : "INITIATE_TRAINING_SIM"}
                                            >
                                                {cold ? 'SIGNAL' : 'TRAIN'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onDeleteJob(job.id)}
                                            style={styles.deleteBtn}
                                            title="TERMINATE_RECORD"
                                        >
                                            DEL
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div style={styles.pagination}>
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 1}
                        style={{
                            ...styles.pageBtn,
                            opacity: currentPage === 1 ? 0.3 : 1,
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        &lt; PREV
                    </button>
                    <span style={styles.pageInfo}>
                        SEQ {currentPage.toString().padStart(2, '0')}/{totalPages.toString().padStart(2, '0')}
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={currentPage === totalPages}
                        style={{
                            ...styles.pageBtn,
                            opacity: currentPage === totalPages ? 0.3 : 1,
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                    >
                        NEXT &gt;
                    </button>
                </div>
            )}
        </div>
    );
};

const getStatusSelectStyle = (status) => {
    const baseColors = {
        'Applied': { border: '#60a5fa', color: '#60a5fa' },
        'Interview': { border: '#fbbf24', color: '#fbbf24' },
        'Offer': { border: '#00ff9d', color: '#00ff9d' },
        'Rejected': { border: '#ff0055', color: '#ff0055' }
    };

    const colors = baseColors[status] || baseColors['Applied'];

    return {
        padding: '4px 8px',
        borderRadius: '2px',
        fontSize: '11px',
        fontWeight: '800',
        border: `1px solid ${colors.border}`,
        backgroundColor: 'transparent',
        color: colors.color,
        cursor: 'pointer',
        outline: 'none',
        fontFamily: '"Roboto Mono", monospace',
        transition: 'all 0.2s ease',
        textShadow: `0 0 5px ${colors.color}80`
    };
};

const styles = {
    container: {
        maxWidth: '1400px',
        margin: '0 auto',
        background: 'rgba(15, 17, 34, 0.6)',
        backdropFilter: 'blur(15px)',
        borderRadius: '4px',
        border: '1px solid rgba(0, 242, 255, 0.2)',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        zIndex: 2,
        position: 'relative'
    },
    tableHeader: {
        padding: '15px 25px',
        background: 'rgba(0, 242, 255, 0.05)',
        borderBottom: '1px solid rgba(0, 242, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    headerLabel: {
        fontSize: '12px',
        fontWeight: '900',
        color: '#00f2ff',
        fontFamily: '"Roboto Mono", monospace',
        letterSpacing: '1px'
    },
    headerDecoration: {
        height: '2px',
        width: '50px',
        background: 'linear-gradient(90deg, #00f2ff, transparent)'
    },
    empty: {
        textAlign: 'center',
        padding: '80px 20px',
        color: '#00f2ff',
        maxWidth: '1400px',
        margin: '0 auto',
        background: 'rgba(15, 17, 34, 0.6)',
        backdropFilter: 'blur(15px)',
        borderRadius: '4px',
        border: '1px solid rgba(0, 242, 255, 0.2)',
        fontFamily: '"Roboto Mono", monospace'
    },
    emptyGlitch: {
        fontSize: '24px',
        fontWeight: '900',
        letterSpacing: '4px',
        marginBottom: '10px'
    },
    emptySub: {
        fontSize: '12px',
        opacity: 0.6,
        letterSpacing: '1px'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: '"Inter", sans-serif'
    },
    th: {
        textAlign: 'left',
        padding: '20px 25px',
        background: 'rgba(255, 255, 255, 0.02)',
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '800',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        fontFamily: '"Roboto Mono", monospace',
        borderBottom: '1px solid rgba(0, 242, 255, 0.1)'
    },
    tr: {
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'all 0.2s ease',
        borderLeft: '4px solid transparent'
    },
    td: {
        padding: '20px 25px',
        color: '#fff',
        fontSize: '14px'
    },
    pagination: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '40px',
        padding: '30px',
        background: 'rgba(0, 242, 255, 0.03)',
        borderTop: '1px solid rgba(0, 242, 255, 0.1)'
    },
    pageBtn: {
        padding: '8px 16px',
        background: 'transparent',
        color: '#00f2ff',
        border: '1px solid rgba(0, 242, 255, 0.3)',
        borderRadius: '2px',
        cursor: 'pointer',
        fontWeight: '900',
        fontSize: '12px',
        fontFamily: '"Roboto Mono", monospace',
        transition: 'all 0.3s ease'
    },
    pageInfo: {
        fontSize: '12px',
        color: '#00f2ff',
        fontWeight: '900',
        fontFamily: '"Roboto Mono", monospace'
    },
    simBtn: {
        background: 'rgba(0, 242, 255, 0.1)',
        border: '1px solid #00f2ff',
        color: '#00f2ff',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: '900',
        fontFamily: '"Roboto Mono", monospace',
        padding: '6px 12px',
        borderRadius: '2px',
        transition: 'all 0.2s ease'
    },
    intelBtn: {
        background: 'rgba(112, 0, 255, 0.2)',
        border: '1px solid #7000ff',
        color: '#d4a5ff',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: '900',
        fontFamily: '"Roboto Mono", monospace',
        padding: '6px 12px',
        borderRadius: '2px',
        transition: 'all 0.2s ease'
    },
    deleteBtn: {
        background: 'transparent',
        border: '1px solid #ff005580',
        color: '#ff0055',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: '900',
        fontFamily: '"Roboto Mono", monospace',
        padding: '6px 12px',
        borderRadius: '2px',
        transition: 'all 0.2s ease'
    },
    cmdGroup: {
        display: 'flex',
        gap: '8px'
    },
    coldIndicator: {
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: '#ff0055',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: '900',
        animation: 'pulse-glow 1s infinite alternate',
        cursor: 'help'
    }
};

export default JobTable;
