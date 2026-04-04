import React, { useState } from 'react';
import { useMediaQuery } from '../utils/useMediaQuery.js';

const BRAND = '#8e5be8';

const Field = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#5f7794', letterSpacing: '0.3px' }}>{label}</label>
        {children}
    </div>
);

const inputStyleBase = (narrow) => ({
    background: '#ffffff', border: '1px solid #d7e0ec', borderRadius: 10,
    color: '#0f1728', padding: narrow ? '12px 14px' : '11px 14px', fontSize: narrow ? 16 : 14,
    outline: 'none', fontFamily: 'inherit', width: '100%',
    boxSizing: 'border-box'
});

export default function AddJobForm({ onAdd, onCancel }) {
    const isNarrow = useMediaQuery('(max-width: 560px)');
    const inputStyle = inputStyleBase(isNarrow);
    const [formData, setFormData] = useState({
        company: '',
        title: '',
        subject: '',
        status: 'Applied',
        date: new Date().toISOString().split('T')[0]
    });

    const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = e => {
        e.preventDefault();
        if (!formData.company || !formData.title) return;
        onAdd({
            id: 'manual_' + Date.now(),
            company: formData.company,
            title: formData.title,
            subject: formData.subject || `${formData.title} at ${formData.company}`,
            status: formData.status,
            date: new Date(formData.date).toISOString(),
            lastUpdated: new Date().toISOString(),
            manualEntry: true
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(244,247,251,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: isNarrow ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: isNarrow ? '0' : '16px',
            paddingBottom: isNarrow ? 'env(safe-area-inset-bottom, 0px)' : '16px',
        }}>
            <div style={{
                background: '#ffffff', border: isNarrow ? 'none' : '1px solid #d7e0ec',
                borderRadius: isNarrow ? '16px 16px 0 0' : 16,
                padding: isNarrow ? '22px 18px 24px' : '32px 28px',
                width: '100%', maxWidth: 480,
                maxHeight: isNarrow ? 'min(92dvh, 100% - env(safe-area-inset-top))' : 'none',
                overflowY: 'auto',
                boxShadow: isNarrow ? '0 -8px 40px rgba(0,0,0,0.12)' : '0 24px 80px rgba(0,0,0,0.5)',
                WebkitOverflowScrolling: 'touch',
            }}>
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#0f1728', marginBottom: 4 }}>Add application</div>
                    <div style={{ fontSize: 13, color: '#5b708a' }}>Manually log a job you applied to</div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Field label="Company *">
                        <input name="company" value={formData.company} onChange={handleChange}
                            placeholder="e.g. Stripe" required style={inputStyle}
                            onFocus={e => e.target.style.borderColor = BRAND}
                            onBlur={e => e.target.style.borderColor = '#d7e0ec'} />
                    </Field>

                    <Field label="Role *">
                        <input name="title" value={formData.title} onChange={handleChange}
                            placeholder="e.g. Software Engineer" required style={inputStyle}
                            onFocus={e => e.target.style.borderColor = BRAND}
                            onBlur={e => e.target.style.borderColor = '#d7e0ec'} />
                    </Field>

                    <Field label="Notes (optional)">
                        <input name="subject" value={formData.subject} onChange={handleChange}
                            placeholder="e.g. Applied via LinkedIn" style={inputStyle}
                            onFocus={e => e.target.style.borderColor = BRAND}
                            onBlur={e => e.target.style.borderColor = '#d7e0ec'} />
                    </Field>

                    <div style={{ display: 'flex', gap: 14, flexDirection: isNarrow ? 'column' : 'row' }}>
                        <Field label="Status">
                            <select name="status" value={formData.status} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer', minHeight: isNarrow ? 48 : undefined }}>
                                <option value="Applied">Applied</option>
                                <option value="Assessment">Assessment</option>
                                <option value="Interview">Interview</option>
                                <option value="Offer">Offer</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </Field>
                        <Field label="Date">
                            <input type="date" name="date" value={formData.date} onChange={handleChange} style={{ ...inputStyle, minHeight: isNarrow ? 48 : undefined }}
                                onFocus={e => e.target.style.borderColor = BRAND}
                            onBlur={e => e.target.style.borderColor = '#d7e0ec'} />
                        </Field>
                    </div>

                    <div style={{
                        display: 'flex', gap: 10, marginTop: 8,
                        justifyContent: 'flex-end', flexDirection: isNarrow ? 'column-reverse' : 'row',
                    }}>
                        <button type="button" onClick={onCancel} style={{
                            background: 'transparent', border: '1px solid #d7e0ec',
                            color: '#6a5f7e', padding: isNarrow ? '12px 20px' : '10px 20px', borderRadius: 8,
                            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', width: isNarrow ? '100%' : 'auto',
                            minHeight: isNarrow ? 48 : undefined,
                        }}>Cancel</button>
                        <button type="submit" style={{
                            background: BRAND, border: 'none', color: '#fff',
                            padding: isNarrow ? '12px 24px' : '10px 24px', borderRadius: 8,
                            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            width: isNarrow ? '100%' : 'auto', minHeight: isNarrow ? 48 : undefined,
                        }}>Add application</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
