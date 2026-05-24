import React from 'react';
import { Clock, CheckCircle, XCircle, Loader2, Database } from 'lucide-react';

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function statusIcon(status) {
  switch (status) {
    case 'done':    return <CheckCircle size={14} color="#5dba8a" />;
    case 'failed':  return <XCircle size={14} color="var(--crimson-100)" />;
    case 'running': return <Loader2 size={14} color="var(--gold)" style={{ animation: 'spin 1s linear infinite' }} />;
    default:        return <Clock size={14} color="var(--ash-400)" />;
  }
}

export default function JobsSidebar({ jobs, selectedId, onSelect, loading }) {
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
        <span className="spinner" style={{ width: 20, height: 20, display: 'inline-block' }} />
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Database size={28} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No jobs yet.</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Create your first assignment above.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>
        Your Jobs ({jobs.length})
      </div>
      {jobs.map(job => (
        <div
          key={job.id}
          className={`job-card glass-card ${selectedId === job.id ? 'selected' : ''}`}
          onClick={() => onSelect(job)}
          style={{ marginBottom: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {statusIcon(job.status)}
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--white)', letterSpacing: '0.04em' }}>
                  DB Assignment
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {job.payload?.scenario?.slice(0, 80) || 'University Management System'}...
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span className={`badge badge-${job.status}`} style={{ fontSize: 9 }}>
              {job.status === 'running' && <span className="animate-pulse-red" style={{ marginRight: 3 }}>●</span>}
              {job.status}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              {formatRelativeTime(job.createdAt)}
            </span>
          </div>
          {job.status === 'running' && job.steps?.length > 0 && (
            <p style={{ fontSize: 10, color: 'var(--gold)', marginTop: 6, fontFamily: 'var(--font-mono)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ▶ {job.steps[job.steps.length - 1]?.message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
