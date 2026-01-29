
import React, { useState, useMemo } from 'react';

const ITEMS_PER_PAGE = 20;

const JobTable = ({ jobs = [], activeFilter = null, onUpdateJob = () => { }, onDeleteJob = () => { } }) => {
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

    if (jobs.length === 0) {
        return <div style={styles.empty}>No applications found. Sync to get started!</div>;
    }

    return (
        <div style={styles.container}>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>Company</th>
                        <th style={styles.th}>Role</th>
                        <th style={styles.th}>Subject</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {currentJobs.map((job) => (
                        <tr
                            key={job.id}
                            style={styles.tr}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <td style={styles.td}>{job.company || 'Unknown'}</td>
                            <td style={{ ...styles.td, fontWeight: '600', color: '#a78bfa' }}>{job.title || 'N/A'}</td>
                            <td style={styles.td}>{job.subject}</td>
                            <td style={styles.td}>
                                <select
                                    value={job.status}
                                    onChange={(e) => handleStatusChange(job.id, e.target.value)}
                                    style={getStatusSelectStyle(job.status)}
                                >
                                    <option value="Applied">Applied</option>
                                    <option value="Interview">Interview</option>
                                    <option value="Offer">Offer</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </td>
                            <td style={styles.td}>{new Date(job.date).toLocaleDateString()}</td>
                            <td style={styles.td}>
                                <button
                                    onClick={() => onDeleteJob(job.id)}
                                    style={styles.deleteBtn}
                                    title="Delete job"
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(248, 113, 113, 0.2)';
                                        e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.3)';
                                    }}
                                >
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div style={styles.pagination}>
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 1}
                        style={{
                            ...styles.pageBtn,
                            opacity: currentPage === 1 ? 0.5 : 1,
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            if (currentPage !== 1) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        }}
                    >
                        Previous
                    </button>
                    <span style={styles.pageInfo}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={currentPage === totalPages}
                        style={{
                            ...styles.pageBtn,
                            opacity: currentPage === totalPages ? 0.5 : 1,
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            if (currentPage !== totalPages) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

const getStatusSelectStyle = (status) => {
    const baseColors = {
        'Applied': { bg: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa' },
        'Interview': { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' },
        'Offer': { bg: 'rgba(52, 211, 153, 0.2)', color: '#34d399' },
        'Rejected': { bg: 'rgba(248, 113, 113, 0.2)', color: '#f87171' }
    };

    const colors = baseColors[status] || baseColors['Applied'];

    return {
        padding: '8px 12px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: '600',
        border: `1px solid ${colors.color}40`,
        backgroundColor: colors.bg,
        color: colors.color,
        cursor: 'pointer',
        outline: 'none',
        transition: 'all 0.2s ease'
    };
};

const styles = {
    container: {
        maxWidth: '1400px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
    },
    empty: {
        textAlign: 'center',
        padding: '60px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '16px',
        maxWidth: '1400px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse'
    },
    th: {
        textAlign: 'left',
        padding: '20px',
        background: 'rgba(255, 255, 255, 0.03)',
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '700',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    tr: {
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'all 0.2s ease'
    },
    td: {
        padding: '18px 20px',
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: '14px'
    },
    pagination: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        padding: '25px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    },
    pageBtn: {
        padding: '10px 20px',
        background: 'rgba(255, 255, 255, 0.1)',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(10px)'
    },
    pageInfo: {
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '600'
    },
    deleteBtn: {
        background: 'rgba(248, 113, 113, 0.1)',
        border: '1px solid rgba(248, 113, 113, 0.3)',
        cursor: 'pointer',
        fontSize: '18px',
        padding: '6px 12px',
        borderRadius: '8px',
        transition: 'all 0.2s ease'
    }
};

export default JobTable;
