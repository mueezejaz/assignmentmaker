import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle, X, ExternalLink } from 'lucide-react';
import { setApiKey } from '../lib/api.js';

export default function ApiKeyModal({ onSuccess, onSkip }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    try {
      await setApiKey(key.trim());
      setDone(true);
      setTimeout(() => onSuccess?.(), 1000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to validate API key');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal glass-card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44,
            background: 'linear-gradient(135deg, var(--crimson-500), var(--crimson-300))',
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--glow-red)',
          }}>
            <KeyRound size={20} color="var(--white)" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--white)', letterSpacing: '0.04em' }}>
              Gemini API Key Required
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Your key is stored locally on the server — never shared
            </p>
          </div>
        </div>

        <div className="ornament" style={{ marginBottom: 24 }}>◆</div>

        <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 20, lineHeight: 1.7 }}>
          This application uses <strong style={{ color: 'var(--text)' }}>Google Gemini</strong> to generate your database assignment.
          Your API key is stored only on your server and never leaves it.
        </p>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--gold)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}
        >
          <ExternalLink size={12} />
          Get a free Gemini API key at Google AI Studio
        </a>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#5dba8a' }}>
            <CheckCircle size={40} style={{ margin: '0 auto 12px' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.05em' }}>
              API Key Validated
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                className="input"
                type={show ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={key}
                onChange={e => setKey(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 14, paddingRight: 48 }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p style={{ color: 'var(--crimson-100)', fontSize: 13, marginBottom: 16, padding: '8px 12px', background: 'rgba(100,10,10,0.3)', border: '1px solid rgba(160,30,30,0.3)', borderRadius: 2 }}>
                ✗ {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !key.trim()}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {loading ? <><span className="spinner" /> Validating...</> : 'Validate & Save Key'}
              </button>
              {onSkip && (
                <button type="button" className="btn btn-ghost" onClick={onSkip}>
                  <X size={14} /> Skip
                </button>
              )}
            </div>
          </form>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20, textAlign: 'center', lineHeight: 1.6 }}>
          Key is stored in <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash-200)' }}>data/[userId]/meta.json</code> on your server
        </p>
      </div>
    </div>
  );
}
