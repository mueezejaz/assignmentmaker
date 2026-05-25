import React, { useState } from 'react';
import { createJob } from '../lib/api.js';

const DEFAULT = `University Management System for a mid-sized Pakistani university. 
The system manages student enrollment, faculty assignments, departmental structure, 
course scheduling across semesters, and tracks daily attendance.`;

export default function GenerateForm({ onJobCreated }) {
    const [scenario, setScenario] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        const text = scenario.trim() || DEFAULT;
        setLoading(true);
        setError('');
        try {
            const data = await createJob(text);
            onJobCreated?.({ ...data, scenario: text });
            setScenario('');
        } catch (err) {
            setError(err?.response?.data?.error || err.message || 'Failed to create job');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="center-area animate-in">
            <h1 className="hero-title">Generate a Database Assignment</h1>
            <p className="hero-sub">
                Describe your system scenario below. The AI will generate ERD diagrams,<br />
                a full report document, and a Python database creation script.
            </p>

            <form onSubmit={handleSubmit}>
                <div className="generate-box">
                    <div className="textarea-label">Your Scenario</div>
                    <textarea
                        className="input"
                        placeholder={DEFAULT}
                        value={scenario}
                        onChange={e => setScenario(e.target.value)}
                        rows={5}
                        style={{ marginBottom: 16, border: 'none', background: 'transparent', padding: '0', boxShadow: 'none', fontSize: 15 }}
                        autoFocus
                    />
                    {error && (
                        <div style={{ padding: '10px 14px', marginBottom: 14, background: 'rgba(232,85,101,0.1)', border: '1px solid rgba(232,85,101,0.3)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--error)' }}>
                            {error}
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? <><span className="spinner" /> Creating Job...</> : 'Generate Full Assignment'}
                    </button>
                </div>
            </form>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {['ERD Diagrams (PNG)', 'Word Report (.docx)', 'MS Access (.accdb)', 'Python Script'].map(t => (
                    <span key={t} style={{ padding: '4px 12px', background: 'rgba(54,173,163,0.08)', border: '1px solid rgba(54,173,163,0.2)', borderRadius: 20, fontSize: 12, color: 'var(--teal)' }}>
                        {t}
                    </span>
                ))}
            </div>
        </div>
    );
}