
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
            alert('Company and Role are required!');
            return;
        }

        const newJob = {
            id: 'manual_' + Date.now(),
            company: formData.company,
            title: formData.title,
            subject: formData.subject || `Manual entry: ${formData.title} at ${formData.company}`,
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
                <h2 style={styles.title}>Add Job Application</h2>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Company *</label>
                        <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            style={styles.input}
                            placeholder="e.g., Google"
                            required
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Role *</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            style={styles.input}
                            placeholder="e.g., Software Engineer"
                            required
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Subject/Notes</label>
                        <input
                            type="text"
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            style={styles.input}
                            placeholder="Optional notes or email subject"
                        />
                    </div>

                    <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Status</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                style={styles.select}
                            >
                                <option value="Applied">Applied</option>
                                <option value="Interview">Interview</option>
                                <option value="Offer">Offer</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>Date</label>
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
                            Cancel
                        </button>
                        <button type="submit" style={styles.submitBtn}>
                            Add Job
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
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: 'linear-gradient(135deg, rgba(15, 12, 41, 0.95) 0%, rgba(48, 43, 99, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '550px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
    },
    title: {
        margin: '0 0 30px 0',
        fontSize: '28px',
        fontWeight: '700',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.5px'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1
    },
    formRow: {
        display: 'flex',
        gap: '15px'
    },
    label: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    input: {
        padding: '12px 16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white'
    },
    select: {
        padding: '12px 16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        cursor: 'pointer'
    },
    buttonGroup: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '10px'
    },
    cancelBtn: {
        padding: '12px 24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.05)',
        cursor: 'pointer',
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        transition: 'all 0.2s'
    },
    submitBtn: {
        padding: '12px 24px',
        border: 'none',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        cursor: 'pointer',
        fontWeight: '600',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
        transition: 'all 0.2s'
    }
};

export default AddJobForm;
