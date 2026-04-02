import React, { useState } from 'react';

const CARDS = [
  { label: 'Total',      status: null,          color: '#9b6cf2', icon: 'All' },
  { label: 'Applied',    status: 'Applied',     color: '#8e5be8', icon: 'A' },
  { label: 'Assessment', status: 'Assessment',  color: '#06b6d4', icon: 'T' },
  { label: 'Interview',  status: 'Interview',   color: '#f59e0b', icon: 'I' },
  { label: 'Offer',      status: 'Offer',       color: '#10b981', icon: 'O' },
  { label: 'Rejected',   status: 'Rejected',    color: '#f87171', icon: 'R' },
];

function StatCard({ label, count, color, icon, isActive, onClick }) {
  const [hov, setHov] = useState(false);
  const on = isActive || hov;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: on ? `${color}12` : '#ffffff',
        border: `1px solid ${on ? color + '50' : '#d7e0ec'}`,
        borderRadius: 14, padding: '20px 20px 18px',
        textAlign: 'left', cursor: 'pointer',
        transition: 'all 0.15s', fontFamily: 'inherit',
        outline: 'none', position: 'relative', overflow: 'hidden'
      }}
    >
      {/* Active indicator bar */}
      {on && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 2, background: color, borderRadius: '12px 12px 0 0'
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${color}18`, border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          color
        }}>
          {icon}
        </div>
        {isActive && (
          <div style={{
            fontSize: 10, fontWeight: 700, color, background: `${color}15`,
            border: `1px solid ${color}30`, padding: '2px 7px', borderRadius: 100,
            letterSpacing: '0.3px'
          }}>ACTIVE</div>
        )}
      </div>

      <div style={{
        fontSize: 30, fontWeight: 800, lineHeight: 1,
        color: on ? color : '#0f1728',
        marginBottom: 5, letterSpacing: '-0.5px',
        transition: 'color 0.15s'
      }}>
        {count}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: on ? color : '#5b708a',
        transition: 'color 0.15s'
      }}>
        {label}
      </div>
    </button>
  );
}

export default function Stats({ jobs = [], activeFilter = null, onFilterClick = () => {} }) {
  const counts = {
    null:       jobs.length,
    Applied:    jobs.filter(j => j.status === 'Applied').length,
    Assessment: jobs.filter(j => j.status === 'Assessment').length,
    Interview:  jobs.filter(j => j.status === 'Interview').length,
    Offer:      jobs.filter(j => j.status === 'Offer').length,
    Rejected:   jobs.filter(j => j.status === 'Rejected').length,
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 12, marginBottom: 20
    }}>
      {CARDS.map(c => (
        <StatCard
          key={c.label}
          label={c.label}
          count={counts[c.status]}
          color={c.color}
          icon={c.icon}
          isActive={activeFilter === c.status}
          onClick={() => onFilterClick(c.status)}
        />
      ))}
    </div>
  );
}
