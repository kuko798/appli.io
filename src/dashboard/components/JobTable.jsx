import React, { useState, useMemo } from 'react';
import { useMediaQuery } from '../utils/useMediaQuery.js';

const ITEMS_PER_PAGE = 20;
const BRAND = '#8e5be8';

const STATUS_STYLES = {
  Applied:    { color: '#8e5be8', bg: '#8e5be80f', border: '#8e5be830' },
  Assessment: { color: '#06b6d4', bg: '#06b6d40f', border: '#06b6d430' },
  Interview:  { color: '#f59e0b', bg: '#f59e0b0f', border: '#f59e0b30' },
  Offer:      { color: '#10b981', bg: '#10b9810f', border: '#10b98130' },
  Rejected:   { color: '#f87171', bg: '#f871710f', border: '#f8717130' },
};

const isCold = date => (Date.now() - new Date(date)) / 86400000 > 10;

const COMPANY_COLORS = ['#8e5be8', '#d56cc7', '#f59e0b', '#10b981', '#ef4444', '#b77af2', '#14b8a6'];
const companyColor = name => COMPANY_COLORS[(name || '').charCodeAt(0) % COMPANY_COLORS.length];

function StatusBadge({ status, onChange }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Applied;
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value)}
      style={{
        background: s.bg, border: `1px solid ${s.border}`,
        color: s.color, padding: '4px 10px', borderRadius: 100,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        outline: 'none', fontFamily: 'inherit', appearance: 'none'
      }}
    >
      <option value="Applied">Applied</option>
      <option value="Assessment">Assessment</option>
      <option value="Interview">Interview</option>
      <option value="Offer">Offer</option>
      <option value="Rejected">Rejected</option>
    </select>
  );
}

function ActionBtn({ children, color = BRAND, onClick, title }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${color}18` : 'transparent',
        border: `1px solid ${hov ? color + '50' : '#d7e0ec'}`,
        color: hov ? color : '#55708f',
        padding: '4px 10px', borderRadius: 6,
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.13s'
      }}
    >{children}</button>
  );
}

function mobileSortBtn(active, brand) {
  return {
    background: active ? `${brand}12` : '#ffffff',
    border: `1px solid ${active ? `${brand}40` : '#d7e0ec'}`,
    color: active ? brand : '#55708f',
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

export default function JobTable({ jobs = [], activeFilter = null, onUpdateJob, onDeleteJob, onSimulateJob, onDeepScan }) {
  const isNarrow = useMediaQuery('(max-width: 720px)');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState(-1); // -1 = desc
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editingRoleValue, setEditingRoleValue] = useState('');

  const filtered = useMemo(() => {
    const list = activeFilter ? jobs.filter(j => j.status === activeFilter) : jobs;
    return [...list].sort((a, b) => {
      if (sortKey === 'date') return sortDir * (new Date(b.date) - new Date(a.date));
      if (sortKey === 'company') return sortDir * (a.company || '').localeCompare(b.company || '');
      return 0;
    });
  }, [jobs, activeFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const current = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  };

  const beginRoleEdit = (job) => {
    setEditingRoleId(job.id);
    setEditingRoleValue(job.title || '');
  };

  const cancelRoleEdit = () => {
    setEditingRoleId(null);
    setEditingRoleValue('');
  };

  const saveRoleEdit = (job) => {
    const nextTitle = editingRoleValue.trim();
    if (!nextTitle) {
      cancelRoleEdit();
      return;
    }
    onUpdateJob(job.id, { title: nextTitle });
    cancelRoleEdit();
  };

  if (jobs.length === 0) {
    return (
      <div style={{
        background: '#ffffff', border: '1px solid #d7e0ec', borderRadius: 14,
        padding: isNarrow ? '56px 20px' : '80px 40px', textAlign: 'center'
      }}>
        <div style={{ fontSize: 38, marginBottom: 16 }}>📭</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#0f1728', marginBottom: 8 }}>No applications yet</div>
        <div style={{ fontSize: 14, color: '#5b708a' }}>Sync your Gmail to import applications, or add one manually.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#ffffff', border: '1px solid #d7e0ec', borderRadius: 14, overflow: 'hidden' }}>

      {/* Table header bar */}
      <div style={{
        padding: isNarrow ? '12px 16px' : '14px 22px', borderBottom: '1px solid #d7e0ec',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 650, color: '#0f1728' }}>Applications</span>
          {activeFilter && (
            <span style={{
              fontSize: 11, color: '#8e5be8', background: '#8e5be812',
              border: '1px solid #8e5be82c', padding: '2px 8px', borderRadius: 100
            }}>{activeFilter}</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#5b708a' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isNarrow ? (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            borderBottom: '1px solid #e5edf7', background: '#f7fafe', flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6883a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sort</span>
            <button type="button" onClick={() => toggleSort('date')} style={mobileSortBtn(sortKey === 'date', BRAND)}>
              Date{sortKey === 'date' ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
            </button>
            <button type="button" onClick={() => toggleSort('company')} style={mobileSortBtn(sortKey === 'company', BRAND)}>
              Company{sortKey === 'company' ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
            </button>
          </div>
          {current.map((job, idx) => {
            const cold = isCold(job.date);
            const canTrain = job.status === 'Interview';
            const color = companyColor(job.company);
            return (
              <div
                key={job.id}
                style={{
                  padding: '16px 16px',
                  borderBottom: idx < current.length - 1 ? '1px solid #e5edf7' : 'none',
                  borderLeft: cold ? '3px solid #f8717140' : '3px solid transparent',
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color
                    }}>
                      {(job.company || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f1728', lineHeight: 1.25 }}>
                        {job.company || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b839f', marginTop: 2 }}>
                        {new Date(job.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <StatusBadge status={job.status} onChange={val => onUpdateJob(job.id, { status: val })} />
                    {cold && (
                      <span title="No activity in 10+ days" style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#f87171', color: '#fff', fontSize: 11, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>!</span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: '#3f5a78', fontWeight: 500 }}>
                  {editingRoleId === job.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        value={editingRoleValue}
                        onChange={e => setEditingRoleValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRoleEdit(job);
                          if (e.key === 'Escape') cancelRoleEdit();
                        }}
                        autoFocus
                        style={{
                          width: '100%',
                          background: '#ffffff',
                          border: `1px solid ${BRAND}55`,
                          borderRadius: 8,
                          color: '#0f1728',
                          padding: '10px 12px',
                          fontSize: 14,
                          fontFamily: 'inherit',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => saveRoleEdit(job)} style={{
                          background: `${BRAND}14`, border: `1px solid ${BRAND}35`, color: BRAND,
                          padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}>Save</button>
                        <button type="button" onClick={cancelRoleEdit} style={{
                          background: 'transparent', border: '1px solid #d7e0ec', color: '#6a5f7e',
                          padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                        }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ wordBreak: 'break-word' }}>{job.title || '—'}</span>
                      <button
                        type="button"
                        onClick={() => beginRoleEdit(job)}
                        style={{
                          background: 'transparent', border: '1px solid #d7e0ec', color: '#6b839f',
                          padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                          flexShrink: 0
                        }}
                      >Edit</button>
                    </div>
                  )}
                </div>
                {job.subject ? (
                  <div style={{
                    marginTop: 8, fontSize: 13, color: '#6b839f', lineHeight: 1.45,
                    wordBreak: 'break-word'
                  }}>
                    {job.subject}
                  </div>
                ) : null}
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <ActionBtn onClick={() => onDeepScan(job)} color="#a78bfa" title="Company intel">Intel</ActionBtn>
                  {(cold || canTrain) && (
                    <ActionBtn
                      onClick={() => onSimulateJob(job, cold ? 'follow-up' : 'interview')}
                      color={cold ? '#f87171' : '#8e5be8'}
                      title={cold ? 'Generate follow-up' : 'Interview prep'}
                    >
                      {cold ? 'Follow Up' : 'Prep'}
                    </ActionBtn>
                  )}
                  <ActionBtn onClick={() => onDeleteJob(job.id)} color="#f87171" title="Delete">Remove</ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f7fafe' }}>
            {[
              { key: 'company', label: 'Company', sortable: true },
              { key: 'title', label: 'Role', sortable: false },
              { key: 'subject', label: 'Subject', sortable: false },
              { key: 'status', label: 'Status', sortable: false },
              { key: 'date', label: 'Date', sortable: true },
              { key: 'actions', label: 'Actions', sortable: false },
            ].map(col => (
              <th
                key={col.key}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                style={{
                  padding: '10px 20px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: sortKey === col.key ? BRAND : '#6883a1',
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none', whiteSpace: 'nowrap'
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4 }}>{sortDir === -1 ? '↓' : '↑'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {current.map((job, idx) => {
            const cold = isCold(job.date);
            const canTrain = job.status === 'Interview';
            const color = companyColor(job.company);
            return (
              <tr
                key={job.id}
                style={{
                  borderBottom: idx < current.length - 1 ? '1px solid #e5edf7' : 'none',
                  borderLeft: cold ? '3px solid #f8717140' : '3px solid transparent',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f6f9fe'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color
                    }}>
                      {(job.company || '?')[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0f1728' }}>
                      {job.company || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '13px 20px', fontSize: 14, color: '#3f5a78', fontWeight: 500 }}>
                  {editingRoleId === job.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
                      <input
                        value={editingRoleValue}
                        onChange={e => setEditingRoleValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRoleEdit(job);
                          if (e.key === 'Escape') cancelRoleEdit();
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: '#ffffff',
                          border: `1px solid ${BRAND}55`,
                          borderRadius: 8,
                          color: '#0f1728',
                          padding: '8px 10px',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveRoleEdit(job)}
                        style={{
                          background: `${BRAND}14`,
                          border: `1px solid ${BRAND}35`,
                          color: BRAND,
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{job.title || '—'}</span>
                      <button
                        type="button"
                        onClick={() => beginRoleEdit(job)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #d7e0ec',
                          color: '#6b839f',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ padding: '13px 20px', fontSize: 12, color: '#6b839f', maxWidth: 220 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.subject || '—'}
                  </span>
                </td>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={job.status} onChange={val => onUpdateJob(job.id, { status: val })} />
                    {cold && (
                      <span title="No activity in 10+ days" style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#f87171', color: '#fff', fontSize: 10, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'help', flexShrink: 0
                      }}>!</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '13px 20px', fontSize: 12, color: '#6b839f', whiteSpace: 'nowrap' }}>
                  {new Date(job.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                </td>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <ActionBtn onClick={() => onDeepScan(job)} color="#a78bfa" title="Company intel">Intel</ActionBtn>
                    {(cold || canTrain) && (
                      <ActionBtn
                        onClick={() => onSimulateJob(job, cold ? 'follow-up' : 'interview')}
                        color={cold ? '#f87171' : '#8e5be8'}
                        title={cold ? 'Generate follow-up' : 'Interview prep'}
                      >
                        {cold ? 'Follow Up' : 'Prep'}
                      </ActionBtn>
                    )}
                    <ActionBtn onClick={() => onDeleteJob(job.id)} color="#f87171" title="Delete">✕</ActionBtn>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}

      {totalPages > 1 && (
        <div style={{
          padding: isNarrow ? '12px 16px' : '14px 22px', borderTop: '1px solid #d7e0ec',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 10
        }}>
          <span style={{ fontSize: 12, color: '#6b839f' }}>
            Page {page} of {totalPages} · {filtered.length} results
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['← Prev', page - 1, page === 1], ['Next →', page + 1, page === totalPages]].map(([label, target, disabled]) => (
              <button
                key={label}
                onClick={() => !disabled && setPage(target)}
                disabled={disabled}
                style={{
                  background: 'transparent', border: '1px solid #d7e0ec',
                  color: disabled ? '#b7acc8' : '#6a5f7e',
                  padding: '6px 14px', borderRadius: 7, fontSize: 12,
                  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
                }}
              >{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
