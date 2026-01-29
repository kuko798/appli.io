
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
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
    },
    title: {
        margin: 0,
        fontSize: '28px',
        color: '#202124',
        fontWeight: '600'
    },
    headerButtons: {
        display: 'flex',
        gap: '10px'
    },
    addBtn: {
        background: '#34a853',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'background 0.2s'
    },
    refreshBtn: {
        background: '#4285f4',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'background 0.2s'
    }
};

export default Dashboard;
