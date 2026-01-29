
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
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
    },
    title: {
        margin: '0 0 20px 0',
        fontSize: '24px',
        color: '#202124',
        fontWeight: '600'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        flex: 1
    },
    formRow: {
        display: 'flex',
        gap: '15px'
    },
    label: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#5f6368'
    },
    input: {
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        transition: 'border 0.2s'
    },
    select: {
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        background: 'white',
        cursor: 'pointer'
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end',
        marginTop: '10px'
    },
    cancelBtn: {
        padding: '10px 20px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        background: 'white',
        cursor: 'pointer',
        fontWeight: '600',
        color: '#5f6368'
    },
    submitBtn: {
        padding: '10px 20px',
        border: 'none',
        borderRadius: '6px',
        background: '#4285f4',
        color: 'white',
        cursor: 'pointer',
        fontWeight: '600'
    }
};

export default AddJobForm;
