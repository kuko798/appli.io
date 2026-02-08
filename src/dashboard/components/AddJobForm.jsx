
import React, { useState } from 'react';

const AddJobForm = ({ onAdd, onCancel }) => {
    const [formData, setFormData] = useState({
        company: '',
        title: '',
        subject: '',
        status: 'Applied',
        date: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.company || !formData.title) {
            alert('CRITICAL: COMPANY AND ROLE DATA REQUIRED');
            return;
        }

        const newJob = {
            id: 'manual_' + Date.now(),
            company: formData.company,
            title: formData.title,
            subject: formData.subject || `MANUAL_ENTRY: ${formData.title} AT ${formData.company}`,
            status: formData.status,
            date: new Date(formData.date).toISOString(),
            lastUpdated: new Date().toISOString(),
            manualEntry: true
        };

        onAdd(newJob);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.corners}>
                    <div style={{ ...styles.corner, top: -1, left: -1, borderTop: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' }}></div>
                    <div style={{ ...styles.corner, top: -1, right: -1, borderTop: '2px solid #00f2ff', borderRight: '2px solid #00f2ff' }}></div>
                    <div style={{ ...styles.corner, bottom: -1, left: -1, borderBottom: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' }}></div>
                    <div style={{ ...styles.corner, bottom: -1, right: -1, borderBottom: '2px solid #00f2ff', borderRight: '2px solid #00f2ff' }}></div>
                </div>

                <div style={styles.header}>
                    <h2 style={styles.title}>INITIALIZE_NEW_RECORD</h2>
                    <div style={styles.headerLine}></div>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>TARGET_COMPANY*</label>
                        <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            style={styles.input}
                            placeholder="INPUT_COMPANY_NAME"
                            required
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>ASSIGNED_ROLE*</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            style={styles.input}
                            placeholder="INPUT_ROLE_TITLE"
                            required
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>SUBJECT_METADATA</label>
                        <input
                            type="text"
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            style={styles.input}
                            placeholder="OPTIONAL_NOTES"
                        />
                    </div>

                    <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>NODE_STATUS</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                style={styles.select}
                            >
                                <option value="Applied">APPLIED</option>
                                <option value="Interview">INTERVIEW</option>
                                <option value="Offer">OFFER</option>
                                <option value="Rejected">REJECTED</option>
                            </select>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>TIMESTAMP</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                style={styles.input}
                            />
                        </div>
                    </div>

                    <div style={styles.buttonGroup}>
                        <button type="button" onClick={onCancel} style={styles.cancelBtn}>
                            ABORT_CMD
                        </button>
                        <button type="submit" style={styles.submitBtn}>
                            EXECUTE_INITIALIZATION
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 7, 20, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: 'rgba(15, 17, 34, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '2px',
        padding: '45px',
        maxWidth: '550px',
        width: '90%',
        boxShadow: '0 0 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 242, 255, 0.1)',
        border: '1px solid rgba(0, 242, 255, 0.2)',
        position: 'relative'
    },
    corners: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none'
    },
    corner: {
        position: 'absolute',
        width: '15px',
        height: '15px'
    },
    header: {
        marginBottom: '35px'
    },
    title: {
        margin: '0 0 10px 0',
        fontSize: '20px',
        fontWeight: '900',
        color: '#00f2ff',
        letterSpacing: '2px',
        fontFamily: '"Roboto Mono", monospace'
    },
    headerLine: {
        height: '2px',
        width: '100%',
        background: 'linear-gradient(90deg, #00f2ff, transparent)'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '25px'
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flex: 1
    },
    formRow: {
        display: 'flex',
        gap: '20px'
    },
    label: {
        fontSize: '11px',
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        fontFamily: '"Roboto Mono", monospace'
    },
    input: {
        padding: '14px 18px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '2px',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.3s',
        background: 'rgba(255, 255, 255, 0.03)',
        color: 'white',
        fontFamily: '"Inter", sans-serif',
        ':focus': {
            border: '1px solid #00f2ff',
            boxShadow: '0 0 10px rgba(0, 242, 255, 0.2)',
            background: 'rgba(0, 242, 255, 0.05)'
        }
    },
    select: {
        padding: '14px 18px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '2px',
        fontSize: '14px',
        outline: 'none',
        background: 'rgba(255, 255, 255, 0.03)',
        color: 'white',
        cursor: 'pointer',
        fontFamily: '"Inter", sans-serif'
    },
    buttonGroup: {
        display: 'flex',
        gap: '15px',
        justifyContent: 'flex-end',
        marginTop: '15px'
    },
    cancelBtn: {
        padding: '14px 28px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '2px',
        background: 'transparent',
        cursor: 'pointer',
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '12px',
        fontFamily: '"Roboto Mono", monospace',
        transition: 'all 0.3s ease'
    },
    submitBtn: {
        padding: '14px 28px',
        border: '1px solid #00f2ff',
        borderRadius: '2px',
        background: 'rgba(0, 242, 255, 0.1)',
        color: '#00f2ff',
        cursor: 'pointer',
        fontWeight: '800',
        fontSize: '12px',
        fontFamily: '"Roboto Mono", monospace',
        boxShadow: '0 0 15px rgba(0, 242, 255, 0.2)',
        transition: 'all 0.3s ease',
        textTransform: 'uppercase'
    }
};

export default AddJobForm;
