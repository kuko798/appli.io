
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
                        <tr key={job.id} style={styles.tr}>
                            <td style={styles.td}>{job.company || 'Unknown'}</td>
                            <td style={{ ...styles.td, fontWeight: '600', color: '#1a73e8' }}>{job.title || 'N/A'}</td>
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
                    <button onClick={handlePrev} disabled={currentPage === 1} style={styles.pageBtn}>
                        Previous
                    </button>
                    <span style={styles.pageInfo}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button onClick={handleNext} disabled={currentPage === totalPages} style={styles.pageBtn}>
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

const getStatusStyle = (status) => {
    const base = {
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'inline-block'
    };
    switch (status) {
        case 'Interview': return { ...base, bg: '#fff8e1', color: '#f9ab00', backgroundColor: '#fff8e1' };
        case 'Offer': return { ...base, bg: '#e6f4ea', color: '#137333', backgroundColor: '#e6f4ea' };
        case 'Rejected': return { ...base, bg: '#fce8e6', color: '#c5221f', backgroundColor: '#fce8e6' };
        default: return { ...base, bg: '#e8f0fe', color: '#1a73e8', backgroundColor: '#e8f0fe' };
    }
};

const getStatusSelectStyle = (status) => {
    const baseColors = {
        'Applied': { bg: '#e8f0fe', color: '#1a73e8' },
        'Interview': { bg: '#fff8e1', color: '#f9ab00' },
        'Offer': { bg: '#e6f4ea', color: '#137333' },
        'Rejected': { bg: '#fce8e6', color: '#c5221f' }
    };

    const colors = baseColors[status] || baseColors['Applied'];

    return {
        padding: '6px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        border: 'none',
        backgroundColor: colors.bg,
        color: colors.color,
        cursor: 'pointer',
        outline: 'none'
    };
};

const styles = {
    container: {
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        overflow: 'hidden'
    },
    empty: {
        textAlign: 'center',
        padding: '40px',
        color: '#666',
        fontSize: '16px'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse'
    },
    th: {
        textAlign: 'left',
        padding: '16px',
        background: '#f8f9fa',
        color: '#5f6368',
        fontWeight: '600',
        borderBottom: '1px solid #eee'
    },
    tr: {
        borderBottom: '1px solid #f1f1f1',
        transition: 'background 0.1s'
    },
    td: {
        padding: '14px 16px',
        color: '#333'
    },
    pagination: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        gap: '15px'
    },
    pageBtn: {
        padding: '8px 16px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        background: 'white',
        cursor: 'pointer'
    },
    pageInfo: {
        fontSize: '14px',
        color: '#666'
    },
    deleteBtn: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '18px',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'background 0.2s'
    }
};

export default JobTable;
