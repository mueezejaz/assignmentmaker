import React from 'react';
import { LogOut, KeyRound, GraduationCap } from 'lucide-react';

export default function Header({ user, onSignOut, onManageKey, hasApiKey }) {
  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || '?';

  return (
    <header className="app-header">
      <div className="app-logo">
        <div className="logo-icon">
          <GraduationCap size={18} color="var(--white)" />
        </div>
        <span>UniGen</span>
        <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 400, letterSpacing: '0.15em', marginLeft: -4 }}>
          ◆ DB ASSISTANT
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onManageKey}
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: '7px 14px', gap: 6 }}
        >
          <KeyRound size={12} />
          {hasApiKey ? 'API Key ✓' : 'Set API Key'}
        </button>

        <div className="user-chip">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div className="user-avatar">{initials}</div>
          )}
          <span style={{ fontSize: 14, color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'User'}
          </span>
          <button
            onClick={onSignOut}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
