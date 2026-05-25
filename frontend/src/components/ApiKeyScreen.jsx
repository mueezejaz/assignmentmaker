import React, { useState } from 'react';
import { setApiKey, setApiKeyHeader, getUserIdFromKey } from '../lib/api.js';

export default function ApiKeyScreen({ onAuth }) {
    const [key, setKey] = useState('');
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        const trimmed = key.trim();
        if (!trimmed) return;
        setLoading(true);
        setError('');
        try {
            setApiKeyHeader(trimmed);
            await setApiKey(trimmed);
            localStorage.setItem('gemini_api_key', trimmed);
            onAuth(trimmed);
        } catch (err) {
            setError(err?.response?.data?.error || 'Invalid API key. Please check and try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="onboard-screen">
            <div className="onboard-card animate-in">
                <div className="onboard-icon">🔑</div>
                <h1 className="onboard-title">UniGen</h1>
                <p className="onboard-sub">
                    AI-powered database assignment generator.<br />
                    Enter your Google Gemini API key to get started.
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 8 }}>
                            Gemini API Key
                        </div>
                        <div className="input-wrap">
                            <input
                                className="input"
                                type={show ? 'text' : 'password'}
                                placeholder="AIzaSy..."
                                value={key}
                                onChange={e => setKey(e.target.value)}
                                style={{ fontFamily: 'var(--mono)', fontSize: 14 }}
                                autoFocus
                            />
                            <button type="button" className="input-icon" onClick={() => setShow(v => !v)}>
                                {show ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', marginBottom: 14, background: 'rgba(232,85,101,0.1)', border: '1px solid rgba(232,85,101,0.3)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--error)' }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading || !key.trim()}>
                        {loading ? <><span className="spinner" /> Validating...</> : '→ Start Generating'}
                    </button>
                </form>

                <div className="divider" />

                <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.7 }}>
                    Your API key is stored securely on the server and used to identify your session.
                    <br />
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
                        Get a free key at Google AI Studio →
                    </a>
                </div>
            </div>
        </div>
    );
}