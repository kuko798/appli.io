
import React, { useEffect, useState } from 'react';
import Stats from './components/Stats';
import JobTable from './components/JobTable';
import AddJobForm from './components/AddJobForm';

function Dashboard() {
    const [jobs, setJobs] = useState([]);
    const [activeFilter, setActiveFilter] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const loadJobs = () => {
        chrome.storage.local.get("jobs", (result) => {
            setJobs(result.jobs || []);
        });
    };

    const saveJobs = (updatedJobs) => {
        chrome.storage.local.set({ jobs: updatedJobs }, () => {
            setJobs(updatedJobs);
        });
    };

    const handleFilterClick = (status) => {
        setActiveFilter(activeFilter === status ? null : status);
    };

    const handleUpdateJob = (jobId, updates) => {
        const updatedJobs = jobs.map(job =>
            job.id === jobId ? { ...job, ...updates, lastUpdated: new Date().toISOString() } : job
        );
        saveJobs(updatedJobs);
    };

    const handleDeleteJob = (jobId) => {
        if (confirm('Are you sure you want to delete this job?')) {
            const updatedJobs = jobs.filter(job => job.id !== jobId);
            saveJobs(updatedJobs);
        }
    };

    const handleAddJob = (newJob) => {
        const updatedJobs = [...jobs, newJob];
        saveJobs(updatedJobs);
        setShowAddForm(false);
    };

    useEffect(() => {
        loadJobs();

        const listener = (changes, namespace) => {
            if (namespace === 'local' && changes.jobs) {
                console.log("Jobs updated, reloading dashboard...");
                loadJobs();
            }
        };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>My Applications</h1>
                <div style={styles.headerButtons}>
                    <button onClick={() => setShowAddForm(true)} style={styles.addBtn}>
                        + Add Job
                    </button>
                    <button onClick={loadJobs} style={styles.refreshBtn}>
                        Refresh Data
                    </button>
                </div>
            </header>

            <Stats jobs={jobs} activeFilter={activeFilter} onFilterClick={handleFilterClick} />
            <JobTable
                jobs={jobs}
                activeFilter={activeFilter}
                onUpdateJob={handleUpdateJob}
                onDeleteJob={handleDeleteJob}
            />

            {showAddForm && (
                <AddJobForm
                    onAdd={handleAddJob}
                    onCancel={() => setShowAddForm(false)}
                />
            )}
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        padding: '40px 20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    header: {
        maxWidth: '1400px',
        margin: '0 auto 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '30px',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
    },
    title: {
        margin: 0,
        fontSize: '32px',
        fontWeight: '700',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.5px'
    },
    headerButtons: {
        display: 'flex',
        gap: '12px'
    },
    addBtn: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '12px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
        transform: 'translateY(0)',
        ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)'
        }
    },
    refreshBtn: {
        background: 'rgba(255, 255, 255, 0.1)',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '12px 24px',
        borderRadius: '12px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(10px)',
        ':hover': {
            background: 'rgba(255, 255, 255, 0.15)',
            borderColor: 'rgba(255, 255, 255, 0.3)'
        }
    }
};

export default Dashboard;
