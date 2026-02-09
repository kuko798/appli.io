
import React, { useEffect, useState, useMemo } from 'react';
import Stats from './components/Stats';
import JobTable from './components/JobTable';
import AddJobForm from './components/AddJobForm';
import InterviewSimulator from './components/InterviewSimulator';
import DeepScan from './components/DeepScan';
import ResumeDiagnostic from './components/ResumeDiagnostic';


function Dashboard() {
    const [jobs, setJobs] = useState([]);
    const [activeFilter, setActiveFilter] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showResumeDiagnostic, setShowResumeDiagnostic] = useState(false);
    const [hoveredStatus, setHoveredStatus] = useState(null);
    const [simulatingJob, setSimulatingJob] = useState(null);
    const [simulationMode, setSimulationMode] = useState('interview');
    const [scanningJob, setScanningJob] = useState(null);
    const [isAuthorized, setIsAuthorized] = useState(null);

    const statusColors = {
        'Applied': '#60a5fa',
        'Interview': '#fbbf24',
        'Offer': '#00ff9d',
        'Rejected': '#ff0055',
        null: '#00f2ff'
    };

    const currentGlow = statusColors[hoveredStatus] || statusColors[null];

    useEffect(() => {
        chrome.storage.sync.get(['groqApiKey'], (result) => {
            if (result.groqApiKey) {
                setIsAuthorized(true);
                loadJobs();
            } else {
                setIsAuthorized(false);
            }
        });

        // Continue loading listeners only if authorized, but for simplicity we rely on the conditional return
    }, []);

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

    const handleSimulateRequest = (job, mode = 'interview') => {
        setSimulationMode(mode);
        setSimulatingJob(job);
    };

    useEffect(() => {
        const listener = (changes, namespace) => {
            if (namespace === 'local' && changes.jobs && isAuthorized) {
                console.log("Jobs updated, reloading dashboard...");
                loadJobs();
            }
        };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, [isAuthorized]);

    // Starfield generator with twinkling and drift support
    const stars = useMemo(() => {
        const generateStars = (count) => {
            let stars = "";
            for (let i = 0; i < count; i++) {
                stars += `${Math.random() * 2000}px ${Math.random() * 2000}px rgba(255, 255, 255, ${Math.random()}), `;
            }
            return stars.slice(0, -2);
        };
        return {
            small: generateStars(400),
            medium: generateStars(150),
            large: generateStars(50)
        };
    }, []);

    if (isAuthorized === null) {
        return <div style={{ ...styles.container, background: '#020308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#00f2ff', fontFamily: 'monospace' }}>INITIALIZING_SYSTEM...</div>
        </div>;
    }

    if (!isAuthorized) {
        return (
            <div style={{ ...styles.container, background: '#020308', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#ff0055', fontFamily: 'monospace', fontSize: '24px', marginBottom: '20px' }}>ACCESS_DENIED</div>
                <div style={{ color: '#00f2ff', fontFamily: 'monospace', marginBottom: '30px' }}>SECURE_CONNECTION_REQUIRED: API_KEY_MISSING</div>
                <button
                    onClick={() => chrome.runtime.openOptionsPage()}
                    style={{
                        background: 'transparent',
                        border: '1px solid #00f2ff',
                        color: '#00f2ff',
                        padding: '15px 30px',
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    INITIALIZE_CONFIGURATION_PROTOCOL
                </button>
            </div>
        );
    }

    return (
        <div style={{ ...styles.container, background: '#020308', transition: 'background 0.8s ease' }}>
            {/* Galaxy Layers with Parallax Drift */}
            <div style={{
                ...styles.starLayer,
                boxShadow: stars.small,
                animation: 'twinkle 4s infinite linear, drift 100s infinite linear'
            }}></div>
            <div style={{
                ...styles.starLayer,
                boxShadow: stars.medium,
                animation: 'twinkle 6s infinite linear, drift 150s infinite linear',
                opacity: 0.6
            }}></div>
            <div style={{
                ...styles.starLayer,
                boxShadow: stars.large,
                animation: 'twinkle 3s infinite linear, drift 200s infinite linear',
                opacity: 0.4
            }}></div>

            {/* Shooting Stars */}
            <div className="shooting-star" style={{ top: '10%', left: '10%', animationDelay: '0s' }}></div>
            <div className="shooting-star" style={{ top: '30%', left: '50%', animationDelay: '4s' }}></div>
            <div className="shooting-star" style={{ top: '70%', left: '20%', animationDelay: '7s' }}></div>

            {/* Nebula Clouds */}
            <div style={{
                position: 'fixed',
                top: '10%',
                left: '20%',
                width: '600px',
                height: '600px',
                background: `radial-gradient(circle, ${currentGlow}20 0%, transparent 70%)`,
                animation: 'nebulaPulse 8s infinite ease-in-out',
                zIndex: 0,
                pointerEvents: 'none',
                transition: 'all 0.8s ease'
            }}></div>
            <div style={{
                position: 'fixed',
                bottom: '10%',
                right: '10%',
                width: '800px',
                height: '800px',
                background: `radial-gradient(circle, ${currentGlow}15 0%, transparent 70%)`,
                animation: 'nebulaPulse 12s infinite ease-in-out',
                zIndex: 0,
                pointerEvents: 'none',
                transition: 'all 0.8s ease'
            }}></div>

            <div style={{ ...styles.gridOverlay, background: `linear-gradient(${currentGlow}05 1px, transparent 1px), linear-gradient(90deg, ${currentGlow}05 1px, transparent 1px)`, transition: 'all 0.8s ease' }}></div>
            <div style={styles.scanline}></div>

            <header style={{ ...styles.header, border: `1px solid ${currentGlow}40`, boxShadow: `0 0 30px ${currentGlow}15`, transition: 'all 0.6s ease' }}>
                <div style={styles.titleContainer}>
                    <h1 style={{ ...styles.title, textShadow: `0 0 15px ${currentGlow}50` }}>APPLI.IO <span style={styles.version}>v1.0</span></h1>
                    <div style={{ ...styles.statusIndicator, color: currentGlow }}>
                        <div style={{ ...styles.pulse, backgroundColor: currentGlow, boxShadow: `0 0 10px ${currentGlow}` }}></div>
                        {hoveredStatus ? `DATA_FOCUS: ${hoveredStatus.toUpperCase()}` : 'SYSTEM_READY'}
                    </div>
                </div>
                <div style={styles.headerButtons}>
                    <button
                        onClick={() => setShowResumeDiagnostic(true)}
                        style={{ ...styles.diagnosticBtn, color: '#00f2ff', borderColor: '#00f2ff40', background: 'rgba(0, 242, 255, 0.05)' }}
                        className="glitch-hover"
                    >
                        RESUME_DIAGNOSTIC
                    </button>
                    <button
                        onClick={() => setShowAddForm(true)}
                        style={{ ...styles.addBtn, color: currentGlow, borderColor: currentGlow, boxShadow: `0 0 15px ${currentGlow}30` }}
                        className="glitch-hover"
                    >
                        <span>+ ADD_JOB</span>
                    </button>
                    <button
                        onClick={loadJobs}
                        style={{ ...styles.refreshBtn, color: currentGlow, borderColor: `${currentGlow}40`, background: `${currentGlow}10` }}
                        className="glitch-hover"
                    >
                        SYNC_DATA
                    </button>
                </div>
            </header>

            <Stats
                jobs={jobs}
                activeFilter={activeFilter}
                onFilterClick={handleFilterClick}
                onHover={setHoveredStatus}
            />
            <JobTable
                jobs={jobs}
                activeFilter={activeFilter}
                onUpdateJob={handleUpdateJob}
                onDeleteJob={handleDeleteJob}
                onSimulateJob={handleSimulateRequest}
                onDeepScan={setScanningJob}
            />

            {showAddForm && (
                <AddJobForm
                    onAdd={handleAddJob}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            {simulatingJob && (
                <InterviewSimulator
                    job={simulatingJob}
                    mode={simulationMode}
                    onCancel={() => setSimulatingJob(null)}
                />
            )}

            {scanningJob && (
                <DeepScan
                    job={scanningJob}
                    onCancel={() => setScanningJob(null)}
                />
            )}

            {showResumeDiagnostic && (
                <ResumeDiagnostic
                    onCancel={() => setShowResumeDiagnostic(false)}
                />
            )}
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', padding: '40px 20px', fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', position: 'relative', overflowX: 'hidden', color: '#e0e0e0' },
    starLayer: { position: 'fixed', top: 0, left: 0, width: '2px', height: '2px', background: 'transparent', zIndex: 0, pointerEvents: 'none', willChange: 'transform' },
    gridOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 },
    scanline: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.1) 50%)', backgroundSize: '100% 4px', pointerEvents: 'none', zIndex: 1, opacity: 0.3 },
    header: { maxWidth: '1400px', margin: '0 auto 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px 35px', background: 'rgba(15, 17, 34, 0.8)', backdropFilter: 'blur(15px)', borderRadius: '12px', position: 'relative', zIndex: 2 },
    titleContainer: { display: 'flex', flexDirection: 'column', gap: '4px' },
    title: { margin: 0, fontSize: '28px', fontWeight: '900', letterSpacing: '2px', background: 'linear-gradient(90deg, #00f2ff, #7000ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: '"Inter", sans-serif' },
    version: { fontSize: '12px', WebkitTextFillColor: 'rgba(0, 242, 255, 0.6)', fontWeight: '600' },
    statusIndicator: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', fontFamily: '"Roboto Mono", monospace' },
    pulse: { width: '6px', height: '6px', borderRadius: '50%' },
    headerButtons: { display: 'flex', gap: '15px' },
    diagnosticBtn: { padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '13px', fontFamily: '"Roboto Mono", monospace', transition: 'all 0.3s ease', textTransform: 'uppercase', border: '1px solid #00f2ff40' },
    addBtn: { background: 'transparent', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '13px', fontFamily: '"Roboto Mono", monospace', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden', textTransform: 'uppercase' },
    refreshBtn: { padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', fontFamily: '"Roboto Mono", monospace', transition: 'all 0.3s ease', textTransform: 'uppercase' }
};

export default Dashboard;
