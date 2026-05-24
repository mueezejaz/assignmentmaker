import React from 'react';
import { GraduationCap, BookOpen, Database, FileText, Cpu } from 'lucide-react';

const FEATURES = [
  { icon: Database, label: 'ERD Generation', desc: 'Mermaid ER diagrams → PNG' },
  { icon: FileText, label: 'LaTeX → DOCX',   desc: 'Professional report document' },
  { icon: Cpu,      label: 'Python DB Code', desc: 'MS Access .accdb script' },
  { icon: BookOpen, label: 'Full Assignment', desc: '3NF normalized schema' },
];

export default function AuthScreen({ onMockSignIn }) {
  return (
    <div className="auth-screen">
      {/* Background decoration */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: `
          radial-gradient(ellipse at 50% -20%, rgba(120, 15, 15, 0.5) 0%, transparent 60%),
          radial-gradient(ellipse at 20% 80%, rgba(80, 8, 8, 0.3) 0%, transparent 50%)
        `,
        pointerEvents: 'none',
      }} />

      {/* Crest */}
      <div className="crest">
        <svg viewBox="0 0 60 60" fill="none">
          <path d="M30 4 L50 15 L50 35 Q50 50 30 56 Q10 50 10 35 L10 15 Z"
            fill="rgba(100,15,15,0.4)" stroke="rgba(180,40,40,0.6)" strokeWidth="1.5" />
          <path d="M30 12 L44 20 L44 34 Q44 45 30 50 Q16 45 16 34 L16 20 Z"
            fill="rgba(150,20,20,0.2)" stroke="rgba(201,168,76,0.4)" strokeWidth="1" />
          <text x="30" y="36" textAnchor="middle" fill="rgba(201,168,76,0.8)"
            fontSize="18" fontFamily="serif" fontWeight="bold">U</text>
        </svg>
      </div>

      <div className="auth-card glass-card">
        <h1 className="auth-title">UniGen</h1>
        <p className="auth-sub">AI-Powered Database Assignment Generator</p>

        <div className="ornament" style={{ marginBottom: 28 }}>◆ EST. 2024 ◆</div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{
              padding: '12px 14px',
              background: 'rgba(10,2,2,0.6)',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon size={14} color="var(--crimson-100)" />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text)', letterSpacing: '0.05em' }}>
                  {label}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Sign in button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {onMockSignIn ? (
            <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%', padding: '14px' }} onClick={onMockSignIn}>
              <GraduationCap size={16} />
              Enter as Developer (Mock Auth)
            </button>
          ) : (
            <div id="clerk-sign-in" />
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
          Your data is stored locally on the server. No external services beyond Gemini AI.
        </p>
      </div>
    </div>
  );
}
