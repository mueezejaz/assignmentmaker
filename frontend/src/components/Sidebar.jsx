import React from 'react';

function relTime(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    return new Date(ts).toLocaleDateString();
}

function StatusDot({ status }) {
    if (status === 'running') return <span className="dot-running" style={{ marginRight: 4 }} />;
    if (status === 'done') return <span style={{ color: 'var(--success)', marginRight: 4 }}>✓</span>;
    if (status === 'failed') return <span style={{ color: 'var(--error)', marginRight: 4 }}>✗</span>;
    return <span style={{ color: 'var(--text-dim)', marginRight: 4 }}>○</span>;
}

export default function Sidebar({ jobs, selectedId, onSelect, onNewJob }) {
    return (
        <>
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <button className="btn btn-primary btn-full btn-sm" onClick={onNewJob}>
                    + New Assignment
                </button>
            </div>

            {jobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-dim)', fontSize: 13 }}>
                    No jobs yet.<br />
                    <span style={{ fontSize: 12 }}>Generate your first assignment above.</span>
                </div>
            ) : (
                <>
                    <div className="sidebar-label">Recent Jobs ({jobs.length})</div>
                    {jobs.map(job => (
                        <div
                            key={job.id}
                            className={`job-item ${selectedId === job.id ? 'active' : ''}`}
                            onClick={() => onSelect(job)}
                        >
                            <div className="job-item-title">
                                <StatusDot status={job.status} />
                                {job.payload?.scenario?.slice(0, 50) || 'Database Assignment'}
                                {job.payload?.scenario?.length > 50 ? '…' : ''}
                            </div>
                            <div className="job-item-meta">
                                <span className={`badge badge-${job.status}`}>{job.status}</span>
                                <span className="job-item-time">{relTime(job.createdAt)}</span>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </>
    );
}