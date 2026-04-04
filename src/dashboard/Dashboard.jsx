import React, { useEffect, useState, lazy, Suspense } from 'react';
import { pullRemoteJobsMergeOnLogin, scheduleRemoteJobsPush, jobsApiBase } from './jobsSync.js';
import { syncUserProfileFromServer } from '../services/userProfileSync.js';
import { useMediaQuery } from './utils/useMediaQuery.js';
import Stats from './components/Stats';
import JobTable from './components/JobTable';
import AddJobForm from './components/AddJobForm';
import InterviewSimulator from './components/InterviewSimulator';
import DeepScan from './components/DeepScan';

/** PDF.js + mammoth are heavy; load only when the user opens the tool (faster dashboard first paint). */
const ResumeOptimizer = lazy(() => import('./components/ResumeOptimizer.jsx'));

const BRAND = '#8e5be8';
const LOGO_PURPLE = '#8e5be8';
const COLORS = {
  bg: '#f5f5f8',
  panel: '#ffffff',
  panelSoft: '#f2f0f7',
  border: '#e1dceb',
  text: '#17171f',
  muted: '#666673',
  subtle: '#898996',
};

const HOME_PATH = '/src/home/index.html';

function readAuthSnapshot() {
  try {
    const token = localStorage.getItem('appli_token');
    if (!token) return { authed: false, email: '', picture: '', name: '' };
    return {
      authed: true,
      email: localStorage.getItem('appli_user_email') || '',
      picture: localStorage.getItem('appli_user_picture') || '',
      name: localStorage.getItem('appli_user_name') || '',
    };
  } catch {
    return { authed: false, email: '', picture: '', name: '' };
  }
}

const Logo = () => (
  <div onClick={() => { window.location.href = HOME_PATH; }} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
    <svg width={26} height={26} viewBox="100 30 180 180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg-dash" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c6ded" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <circle cx="190" cy="120" r="90" fill="none" stroke="#ddd6fe" strokeWidth="7" />
      <circle cx="190" cy="120" r="90" fill="none" stroke="url(#lg-dash)" strokeWidth="7"
        strokeLinecap="round" strokeDasharray="362 452" strokeDashoffset="113" />
      <circle cx="190" cy="120" r="76" fill="#ffffff" />
      <rect x="165" y="113" width="50" height="34" rx="6" fill="none" stroke="url(#lg-dash)" strokeWidth="2" />
      <rect x="178" y="106" width="24" height="10" rx="4" fill="none" stroke="url(#lg-dash)" strokeWidth="2" />
      <line x1="190" y1="113" x2="190" y2="147" stroke="url(#lg-dash)" strokeWidth="1.5" opacity="0.4" />
    </svg>
    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: '#17171f' }}>
      appli
      <span style={{
        background: 'linear-gradient(135deg, #8e5be8, #d56cc7)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>.io</span>
    </span>
  </div>
);

function Avatar({ email, pictureUrl }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => {
    setImgErr(false);
  }, [pictureUrl]);
  const initial = email ? email[0].toUpperCase() : '?';
  if (pictureUrl && !imgErr) {
    return (
      <img
        src={pictureUrl}
        alt=""
        width={32}
        height={32}
        referrerPolicy="no-referrer"
        onError={() => setImgErr(true)}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
          border: `1px solid ${COLORS.border}`,
        }}
      />
    );
  }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: `linear-gradient(135deg, ${BRAND}, #d56cc7)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0
    }}>{initial}</div>
  );
}

export default function Dashboard() {
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [jobs, setJobs] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showResumeOptimizer, setShowResumeOptimizer] = useState(false);
  const [simulatingJob, setSimulatingJob] = useState(null);
  const [simulationMode, setSimulationMode] = useState('interview');
  const [scanningJob, setScanningJob] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncRange, setSyncRange] = useState('1m');
  const [userEmail, setUserEmail] = useState(() => readAuthSnapshot().email);
  const [userPicture, setUserPicture] = useState(() => readAuthSnapshot().picture);
  const [userName, setUserName] = useState(() => readAuthSnapshot().name);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAuthed, setIsAuthed] = useState(() => readAuthSnapshot().authed);
  const [activeFilter, setActiveFilter] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('appli_token');
    if (!token) {
      window.location.replace(HOME_PATH);
      return;
    }
    setIsAuthed(true);
    setUserEmail(localStorage.getItem('appli_user_email') || '');
    setUserPicture(localStorage.getItem('appli_user_picture') || '');
    setUserName(localStorage.getItem('appli_user_name') || '');
    (async () => {
      await pullRemoteJobsMergeOnLogin();
      await syncUserProfileFromServer();
      setUserEmail(localStorage.getItem('appli_user_email') || '');
      setUserPicture(localStorage.getItem('appli_user_picture') || '');
      setUserName(localStorage.getItem('appli_user_name') || '');
      loadJobs();
    })();
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    const token = localStorage.getItem('appli_token');
    if (!token) return;
    if (localStorage.getItem('appli_user_picture')) return;
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info) return;
        if (info.picture) {
          localStorage.setItem('appli_user_picture', info.picture);
          setUserPicture(info.picture);
        }
        if (info.email && !localStorage.getItem('appli_user_email')) {
          localStorage.setItem('appli_user_email', info.email);
          setUserEmail(info.email);
        }
        if (info.name && !localStorage.getItem('appli_user_name')) {
          localStorage.setItem('appli_user_name', info.name);
          setUserName(info.name);
        }
      })
      .catch(() => {});
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    const listener = (changes, ns) => {
      if (ns === 'local' && changes.jobs) loadJobs();
    };
    // `chrome.storage` is the real MV3 API in extensions; in the web app it is backed by localStorage (see mocks/webShim.js).
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [isAuthed]);

  const loadJobs = () => {
    chrome.storage.local.get('jobs', r => setJobs(r.jobs || []));
  };

  const saveJobs = updated => {
    chrome.storage.local.set({ jobs: updated }, () => {
      setJobs(updated);
      scheduleRemoteJobsPush();
    });
  };

  const handleUpdateJob = (id, updates) => {
    saveJobs(jobs.map(j => j.id === id ? { ...j, ...updates, lastUpdated: new Date().toISOString() } : j));
  };

  const handleDeleteJob = id => {
    if (confirm('Remove this application?')) saveJobs(jobs.filter(j => j.id !== id));
  };

  const handleAddJob = job => {
    saveJobs([...jobs, job]);
    setShowAddForm(false);
  };

  const handleGmailSync = () => {
    const runSync = () => {
      setIsSyncing(true);
      setSyncStatus('Syncing…');
      // Web shim implements `sendMessage` → gmailService.startSync; real extension uses the background worker.
      chrome.runtime.sendMessage({ action: 'sync', range: syncRange }, response => {
        if (chrome.runtime?.lastError) {
          setSyncStatus(`Error: ${chrome.runtime.lastError.message}`);
          setIsSyncing(false);
          setTimeout(() => setSyncStatus(''), 5000);
          return;
        }
        const msg = response || 'Sync complete';
        setSyncStatus(msg.startsWith('Error') ? msg : 'Sync complete');
        setIsSyncing(false);
        loadJobs();
        scheduleRemoteJobsPush();
        setTimeout(() => setSyncStatus(''), 4000);
      });
    };

    const token = localStorage.getItem('appli_token');
    if (token) {
      runSync();
      return;
    }

    if (!chrome.identity?.getAuthToken) {
      setSyncStatus('Error: Google auth unavailable');
      setTimeout(() => setSyncStatus(''), 4000);
      return;
    }

    setSyncStatus('Authorizing Gmail…');
    chrome.identity.getAuthToken({ interactive: true }, (freshToken) => {
      if (!freshToken) {
        setSyncStatus('Error: Not signed in');
        setTimeout(() => setSyncStatus(''), 4000);
        return;
      }
      localStorage.setItem('appli_token', freshToken);
      runSync();
    });
  };

  const handleLogout = () => {
    if (chrome.identity?.removeCachedAuthToken) {
      chrome.identity.removeCachedAuthToken({ token: localStorage.getItem('appli_token') }, () => {});
    }
    localStorage.removeItem('appli_token');
    localStorage.removeItem('appli_user_email');
    localStorage.removeItem('appli_user_picture');
    localStorage.removeItem('appli_user_name');
    window.location.href = HOME_PATH;
  };

  if (!isAuthed) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        background: '#f4f7fb',
        color: '#5b708a',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1728', marginBottom: 8 }}>Redirecting to sign in…</div>
        <div style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
          If this page stays blank, open the browser console (F12) and check for script errors or blocked requests to <code style={{ fontSize: 12 }}>/assets/</code>.
        </div>
      </div>
    );
  }

  const isError = syncStatus.toLowerCase().startsWith('error');
  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(1200px 480px at -5% -10%, #d4e2ff66 0%, transparent 65%),
                   radial-gradient(1000px 420px at 105% 0%, #dbeeff55 0%, transparent 60%),
                   ${COLORS.bg}`,
      color: COLORS.text,
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
    }}>

      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(244,247,251,0.86)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${COLORS.border}`,
        padding: isNarrow
          ? `max(8px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right, 0px)) 12px max(14px, env(safe-area-inset-left, 0px))`
          : `0 max(22px, env(safe-area-inset-right, 0px)) 0 max(22px, env(safe-area-inset-left, 0px))`,
        minHeight: isNarrow ? undefined : 64,
        height: isNarrow ? 'auto' : 64,
        display: 'flex',
        flexDirection: isNarrow ? 'column' : 'row',
        alignItems: isNarrow ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isNarrow ? 10 : 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: isNarrow ? undefined : 64,
        }}>
          <Logo />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!isNarrow && syncStatus && (
              <span style={{
                fontSize: 12, color: isError ? '#f87171' : '#10b981',
                background: isError ? '#f8717110' : '#10b98110',
                border: `1px solid ${isError ? '#f8717130' : '#10b98130'}`,
                padding: '5px 10px', borderRadius: 999, maxWidth: 280,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>{syncStatus}</span>
            )}

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Account menu"
                onClick={() => setShowUserMenu(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 8, margin: -8,
                  display: 'flex', alignItems: 'center', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Avatar email={userEmail} pictureUrl={userPicture} />
              </button>
              {showUserMenu && (
                <>
                  <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{
                    position: 'absolute', top: 44, right: 0, zIndex: 50,
                    background: COLORS.panelSoft, border: `1px solid ${COLORS.border}`,
                    borderRadius: 12, padding: 8,                     minWidth: 200,
                    maxWidth: 'min(280px, calc(100vw - 24px))',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.18)'
                  }}>
                    {(userEmail || userName) && (
                      <div style={{ padding: '8px 12px', marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: COLORS.subtle, marginBottom: 2 }}>Signed in as</div>
                        {userName ? (
                          <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, marginBottom: 4 }}>{userName}</div>
                        ) : null}
                        {userEmail ? (
                          <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 500, wordBreak: 'break-all' }}>{userEmail}</div>
                        ) : null}
                      </div>
                    )}
                    <div style={{ height: 1, background: COLORS.border, margin: '4px 0' }} />
                    <button type="button" onClick={handleLogout} style={{
                      width: '100%', textAlign: 'left', background: 'transparent',
                      border: 'none', color: '#f87171', padding: '10px 12px',
                      borderRadius: 6, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                      minHeight: 44,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8717110'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >Sign out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {isNarrow && syncStatus && (
          <span style={{
            fontSize: 12, color: isError ? '#f87171' : '#10b981',
            background: isError ? '#f8717110' : '#10b98110',
            border: `1px solid ${isError ? '#f8717130' : '#10b98130'}`,
            padding: '8px 12px', borderRadius: 10,
            display: 'block', lineHeight: 1.35, wordBreak: 'break-word',
          }}>{syncStatus}</span>
        )}

        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
          width: '100%', paddingBottom: isNarrow ? 2 : 0,
        }}>
          <select
            value={syncRange}
            onChange={e => setSyncRange(e.target.value)}
            aria-label="Gmail sync range"
            style={{
              background: COLORS.panelSoft, border: `1px solid ${COLORS.border}`,
              color: COLORS.muted, padding: isNarrow ? '10px 12px' : '7px 11px', borderRadius: 8,
              fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
              flex: isNarrow ? '1 1 auto' : 'none', minWidth: isNarrow ? 120 : undefined,
              minHeight: isNarrow ? 44 : undefined,
            }}
          >
            <option value="1m">30 days</option>
            <option value="3m">90 days</option>
            <option value="6m">180 days</option>
            <option value="1y">1 year</option>
          </select>

          {!isNarrow && (
            <button type="button" onClick={() => setShowResumeOptimizer(true)} style={ghostBtn}>
              Resume optimizer
            </button>
          )}

          <button type="button" onClick={() => setShowAddForm(true)} style={{
            ...primaryBtn,
            padding: isNarrow ? '10px 16px' : primaryBtn.padding,
            minHeight: isNarrow ? 44 : undefined,
            flex: isNarrow ? '1 1 auto' : 'none',
          }}>
            Add job
          </button>

          <button
            type="button"
            title={jobsApiBase() ? 'Jobs sync to your account across devices.' : 'Jobs stay on this browser unless VITE_JOBS_API_BASE + CORS are configured on the server.'}
            onClick={handleGmailSync}
            disabled={isSyncing}
            style={{
              background: isSyncing ? '#c8b4eb' : BRAND,
              border: 'none', color: '#fff',
              padding: isNarrow ? '10px 16px' : '8px 16px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: isSyncing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: isSyncing ? 0.7 : 1, transition: 'all 0.15s',
              minHeight: isNarrow ? 44 : undefined,
              flex: isNarrow ? '1 1 100%' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isSyncing ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
                </svg>
                Syncing…
              </>
            ) : 'Sync Gmail'}
          </button>
        </div>
      </header>

      <main style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: isNarrow
          ? `16px max(14px, env(safe-area-inset-left, 0px)) max(80px, env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-right, 0px))`
          : `24px max(22px, env(safe-area-inset-left, 0px)) 80px max(22px, env(safe-area-inset-right, 0px))`
      }}>
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: isNarrow ? '16px 16px' : '18px 20px',
          marginBottom: 14
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isNarrow ? 'flex-start' : 'center', gap: 14, flexWrap: 'wrap', flexDirection: isNarrow ? 'column' : 'row' }}>
            <div>
              <h1 style={{ fontSize: isNarrow ? 19 : 22, margin: 0, lineHeight: 1.2 }}>Application Command Center</h1>
              <p style={{ fontSize: 13, color: COLORS.subtle, margin: '6px 0 0' }}>
                Clean pipeline tracking with AI support tools.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, width: isNarrow ? '100%' : 'auto', flexDirection: isNarrow ? 'column' : 'row' }}>
              <button type="button" style={{ ...ghostBtn, width: isNarrow ? '100%' : 'auto', minHeight: isNarrow ? 44 : undefined, padding: isNarrow ? '11px 14px' : ghostBtn.padding }} onClick={() => setShowResumeOptimizer(true)}>Resume optimizer</button>
              <button type="button" style={{ ...primaryBtn, width: isNarrow ? '100%' : 'auto', minHeight: isNarrow ? 44 : undefined, padding: isNarrow ? '11px 14px' : primaryBtn.padding }} onClick={() => setShowAddForm(true)}>Add application</button>
            </div>
          </div>
        </div>

        <Stats
          jobs={jobs}
          activeFilter={activeFilter}
          onFilterClick={s => setActiveFilter(activeFilter === s ? null : s)}
        />
        <JobTable
          jobs={jobs}
          activeFilter={activeFilter}
          onUpdateJob={handleUpdateJob}
          onDeleteJob={handleDeleteJob}
          onSimulateJob={(job, mode) => { setSimulationMode(mode); setSimulatingJob(job); }}
          onDeepScan={setScanningJob}
        />
      </main>

      {showAddForm && <AddJobForm onAdd={handleAddJob} onCancel={() => setShowAddForm(false)} />}
      {simulatingJob && <InterviewSimulator job={simulatingJob} mode={simulationMode} onCancel={() => setSimulatingJob(null)} />}
      {scanningJob && <DeepScan job={scanningJob} onCancel={() => setScanningJob(null)} />}
      {showResumeOptimizer && (
        <Suspense
          fallback={
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2000,
                background: 'rgba(244,247,251,0.76)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1728' }}>Loading resume optimizer…</div>
              <div style={{ fontSize: 13, color: '#6f8299' }}>PDF and document libraries are downloading</div>
              <button
                type="button"
                onClick={() => setShowResumeOptimizer(false)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d7e0ec',
                  color: '#6a5f7e',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          }
        >
          <ResumeOptimizer onCancel={() => setShowResumeOptimizer(false)} />
        </Suspense>
      )}
    </div>
  );
}

const ghostBtn = {
  background: '#ffffff', border: '1px solid #e1dceb',
  color: '#5e5470', padding: '8px 14px', borderRadius: 8,
  fontSize: 13, fontWeight: 550, cursor: 'pointer', fontFamily: 'inherit',
  transition: 'all 0.15s'
};

const primaryBtn = {
  background: BRAND,
  border: '1px solid #8e5be8',
  color: '#fff',
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 650,
  cursor: 'pointer',
  fontFamily: 'inherit'
};
