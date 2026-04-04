import React, { useState } from 'react';
import { useMediaQuery } from '../dashboard/utils/useMediaQuery.js';

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

const capabilities = [
  {
    tag: 'Inbox Intelligence',
    title: 'Parse every application signal from Gmail',
    desc: 'Appli.io continuously syncs your inbox and auto-classifies updates into Applied, Assessment, Interview, Offer, and Rejected.',
    bullets: ['One-click sync', 'Auto status extraction', 'Structured job timeline']
  },
  {
    tag: 'Execution Layer',
    title: 'Move from tracking to action',
    desc: 'Prepare interviews, generate follow-ups, and investigate companies from the same application record.',
    bullets: ['Interview simulator', 'Follow-up generation', 'Company deep scan']
  },
  {
    tag: 'Performance Feedback',
    title: 'Improve outcomes with targeted diagnostics',
    desc: 'Analyze resume strength and get actionable rewrites to increase response and interview conversion.',
    bullets: ['Bullet scoring', 'Rewrite suggestions', 'Improvement roadmap']
  }
];

function Logo({ size = 28 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="100 30 180 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lg-home-scale" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8e5be8" />
            <stop offset="100%" stopColor="#d56cc7" />
          </linearGradient>
        </defs>
        <circle cx="190" cy="120" r="90" fill="none" stroke="#ddd6fe" strokeWidth="7" />
        <circle cx="190" cy="120" r="90" fill="none" stroke="url(#lg-home-scale)" strokeWidth="7" strokeLinecap="round" strokeDasharray="362 452" strokeDashoffset="113" />
        <circle cx="190" cy="120" r="76" fill="#ffffff" />
        <rect x="165" y="113" width="50" height="34" rx="6" fill="none" stroke="url(#lg-home-scale)" strokeWidth="2" />
        <rect x="178" y="106" width="24" height="10" rx="4" fill="none" stroke="url(#lg-home-scale)" strokeWidth="2" />
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
}

function handleSignIn() {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (!token) {
      alert('Sign-in failed or was cancelled. Please try again.');
      return;
    }
    localStorage.setItem('appli_token', token);
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(info => {
      if (info.email) localStorage.setItem('appli_user_email', info.email);
      if (info.picture) localStorage.setItem('appli_user_picture', info.picture);
      else localStorage.removeItem('appli_user_picture');
    }).catch(() => {}).finally(() => {
      window.location.href = '/src/dashboard/index.html';
    });
  });
}

function WaitlistModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(244,247,251,0.86)',
      backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 440, background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22 }}>
        {!done ? (
          <>
            <h3 style={{ margin: 0, fontSize: 20 }}>Join Pro waitlist</h3>
            <p style={{ margin: '8px 0 16px', color: COLORS.muted, fontSize: 14 }}>We will notify you as soon as Pro billing opens.</p>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@domain.com"
              style={{ width: '100%', background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, padding: '11px 12px', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={onClose} style={btnGhost}>Cancel</button>
              <button onClick={() => setDone(true)} style={btnPrimary}>Join waitlist</button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0, fontSize: 20 }}>You are in</h3>
            <p style={{ margin: '8px 0 16px', color: COLORS.muted, fontSize: 14 }}>Confirmation will be sent to {email || 'your email'}.</p>
            <button onClick={onClose} style={{ ...btnPrimary, width: '100%' }}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}

function HeroPanel() {
  return (
    <div style={{
      background: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 18,
      padding: 20
    }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.subtle, marginBottom: 10 }}>
        Live Pipeline
      </div>
      {[
        { label: 'Total Applications', value: '47', color: '#0f1728' },
        { label: 'Interviewing', value: '9', color: '#f59e0b' },
        { label: 'Offers', value: '2', color: '#10b981' },
        { label: 'Needs Follow-up', value: '6', color: '#ef4444' },
      ].map(item => (
        <div key={item.label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 0', borderBottom: `1px solid ${COLORS.border}`
        }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>{item.label}</span>
          <span style={{ fontSize: 20, fontWeight: 750, color: item.color }}>{item.value}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, background: '#f3eaff', border: '1px solid #d9c3f5', borderRadius: 12, padding: 10 }}>
        <div style={{ fontSize: 12, color: '#6f5b90' }}>Conversion trend</div>
        <div style={{ marginTop: 8, height: 6, background: '#e7d8f5', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: '63%', height: '100%', background: 'linear-gradient(90deg,#8e5be8,#d56cc7)' }} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const isCompact = useMediaQuery('(max-width: 560px)');
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [billingMode, setBillingMode] = useState('monthly');
  const proPrice = billingMode === 'monthly' ? '$9.99' : '$95';
  const proPeriod = billingMode === 'monthly' ? '/ month' : '/ year';
  const proSubtext = billingMode === 'monthly' ? 'Billed monthly' : 'Save ~21% with annual billing';

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      background: `radial-gradient(900px 420px at 10% -5%, #eadcff80 0%, transparent 60%),
                   radial-gradient(900px 350px at 100% 0%, #f5dff180 0%, transparent 60%),
                   ${COLORS.bg}`,
      color: COLORS.text
    }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        minHeight: isCompact ? undefined : 68,
        padding: isCompact
          ? `max(10px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px))`
          : '0 max(28px, env(safe-area-inset-right, 0px)) 0 max(28px, env(safe-area-inset-left, 0px))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        background: 'rgba(244,247,251,0.9)', borderBottom: `1px solid ${COLORS.border}`,
        backdropFilter: 'blur(12px)'
      }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: isCompact ? '100%' : 'auto' }}>
          <button type="button" onClick={handleSignIn} style={{ ...btnGhost, flex: isCompact ? 1 : 'none', minHeight: isCompact ? 44 : undefined }}>Sign in</button>
          <button type="button" onClick={handleSignIn} style={{ ...btnPrimary, flex: isCompact ? 1 : 'none', minHeight: isCompact ? 44 : undefined }}>Open dashboard</button>
        </div>
      </nav>

      <section style={{ maxWidth: 1220, margin: '0 auto', padding: isCompact ? '32px 16px 18px' : '56px 28px 22px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? '1fr' : '1.1fr 0.9fr',
          gap: isNarrow ? 20 : 24,
          alignItems: 'start'
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              background: COLORS.panelSoft,
              border: `1px solid ${COLORS.border}`,
              color: '#7a6c92',
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 999,
              marginBottom: 14
            }}>
              Purpose-built for high-volume job searches
            </div>
            <h1 style={{ margin: 0, fontSize: isCompact ? 'clamp(32px, 9vw, 48px)' : 'clamp(40px,5vw,72px)', lineHeight: 1.02, letterSpacing: '-1.6px' }}>
              Reliable workflow
              <br />
              for every application
            </h1>
            <p style={{ margin: '16px 0 0', color: COLORS.muted, fontSize: isCompact ? 16 : 18, maxWidth: 680, lineHeight: 1.6 }}>
              Appli.io combines inbox intelligence, pipeline visibility, and AI execution tools so you can operate your job search with precision.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap', flexDirection: isCompact ? 'column' : 'row' }}>
              <button type="button" onClick={handleSignIn} style={{ ...btnPrimary, padding: '11px 18px', width: isCompact ? '100%' : 'auto', minHeight: isCompact ? 48 : undefined }}>Start free</button>
              <button type="button" onClick={() => setShowWaitlist(true)} style={{ ...btnGhost, padding: '11px 18px', width: isCompact ? '100%' : 'auto', minHeight: isCompact ? 48 : undefined }}>Join Pro waitlist</button>
            </div>
          </div>
          <HeroPanel />
        </div>
      </section>

      <section style={{ borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, background: '#f2eef8' }}>
        <div style={{ maxWidth: 1220, margin: '0 auto', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          {['Google Workspace', 'LinkedIn Jobs', 'Greenhouse', 'Lever', 'Workday', 'Ashby'].map(name => (
            <span key={name} style={{ fontSize: 13, color: '#7a6c92', fontWeight: 600 }}>{name}</span>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1220, margin: '0 auto', padding: isCompact ? '28px 16px 20px' : '36px 28px 24px', display: 'grid', gap: 14 }}>
        {capabilities.map((item, idx) => (
          <div key={item.title} style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: isCompact ? 18 : 22,
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
            gap: 16
          }}>
            <div style={{ order: isNarrow ? 0 : (idx % 2 === 0 ? 0 : 1) }}>
              <div style={{ color: '#7a6c92', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{item.tag}</div>
              <h3 style={{ margin: 0, fontSize: isCompact ? 22 : 28, letterSpacing: '-0.4px' }}>{item.title}</h3>
              <p style={{ margin: '10px 0 0', color: COLORS.muted, lineHeight: 1.6 }}>{item.desc}</p>
            </div>
            <div style={{ order: isNarrow ? 1 : (idx % 2 === 0 ? 1 : 0), background: COLORS.panelSoft, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
              {item.bullets.map(b => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: BRAND, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#5f516f' }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ maxWidth: 1220, margin: '0 auto', padding: '10px 28px 42px' }}>
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 24,
          marginBottom: 14
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.6px' }}>Pricing system</h2>
              <p style={{ margin: '8px 0 0', color: COLORS.muted, fontSize: 14 }}>
                Start free, upgrade when you need advanced AI execution.
              </p>
            </div>
            <div style={{
              background: COLORS.panelSoft,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 999,
              padding: 4,
              display: 'inline-flex',
              gap: 4
            }}>
              {[
                { id: 'monthly', label: 'Monthly' },
                { id: 'annual', label: 'Annual' },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setBillingMode(mode.id)}
                  style={{
                    border: 'none',
                    background: billingMode === mode.id ? '#ffffff' : 'transparent',
                    color: billingMode === mode.id ? '#5f3f92' : '#817398',
                    borderRadius: 999,
                    padding: '7px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#ffffff', border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.subtle }}>Free</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 38, fontWeight: 800 }}>$0</span>
                <span style={{ color: COLORS.subtle, fontSize: 13 }}>/ forever</span>
              </div>
              <div style={{ marginTop: 10, color: COLORS.muted, fontSize: 14 }}>
                Core tracking for individuals.
              </div>
              <div style={{ marginTop: 14, display: 'grid', gap: 7 }}>
                {['Gmail sync', 'Application dashboard', 'Status management', 'Manual entry + notes'].map(item => (
                  <div key={item} style={{ fontSize: 13, color: '#355579' }}>• {item}</div>
                ))}
              </div>
              <button onClick={handleSignIn} style={{ ...btnGhost, marginTop: 16, width: '100%' }}>Start free</button>
            </div>

            <div style={{ background: 'linear-gradient(135deg,#f3eaff 0%,#f8e9f5 100%)', border: '1px solid #d9c3f5', borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#7a45c7' }}>Pro</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7a45c7', border: '1px solid #cfb2f2', background: '#fbf5ff', borderRadius: 999, padding: '3px 8px' }}>
                  Most popular
                </span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: '#5d2ea8' }}>{proPrice}</span>
                <span style={{ color: '#6e5a8e', fontSize: 13 }}>{proPeriod}</span>
              </div>
              <div style={{ marginTop: 6, color: '#6e5a8e', fontSize: 13 }}>{proSubtext}</div>
              <div style={{ marginTop: 14, display: 'grid', gap: 7 }}>
                {['Everything in Free', 'Resume optimizer & compare', 'Interview Simulator', 'Company Deep Scan', 'AI follow-up generation'].map(item => (
                  <div key={item} style={{ fontSize: 13, color: '#5c4b75' }}>• {item}</div>
                ))}
              </div>
              <button onClick={() => setShowWaitlist(true)} style={{ ...btnPrimary, marginTop: 16, width: '100%' }}>
                Join Pro waitlist
              </button>
            </div>
          </div>
        </div>

        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.8px' }}>Run your job search like a system</h2>
          <p style={{ margin: '10px auto 0', maxWidth: 700, color: COLORS.muted, lineHeight: 1.65 }}>
            Keep your current workflow and add structured visibility, better execution, and faster iteration.
          </p>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleSignIn} style={{ ...btnPrimary, padding: '11px 18px' }}>Open dashboard</button>
            <button onClick={() => setShowWaitlist(true)} style={{ ...btnGhost, padding: '11px 18px' }}>Talk to us</button>
          </div>
        </div>
      </section>

      <footer style={{
        borderTop: `1px solid ${COLORS.border}`,
        padding: isCompact
          ? `18px max(16px, env(safe-area-inset-left)) calc(26px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-right))`
          : '18px 28px 26px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexDirection: isCompact ? 'column' : 'row', gap: isCompact ? 12 : 0,
        textAlign: isCompact ? 'center' : 'left'
      }}>
        <Logo size={22} />
        <span style={{ fontSize: 12, color: COLORS.subtle }}>© 2026 Appli.io</span>
      </footer>

      {showWaitlist && <WaitlistModal onClose={() => setShowWaitlist(false)} />}
    </div>
  );
}

const btnPrimary = {
  background: BRAND,
  color: '#fff',
  border: '1px solid #8e5be8',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 14,
  fontWeight: 650,
  cursor: 'pointer',
  fontFamily: 'inherit'
};

const btnGhost = {
  background: '#ffffff',
  color: '#5e5470',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 14,
  fontWeight: 550,
  cursor: 'pointer',
  fontFamily: 'inherit'
};
