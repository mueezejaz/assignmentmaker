import React, { useEffect, useState } from 'react';
import { useJobPoller } from '../hooks/useJobPoller.js';
import StepLog from './StepLog.jsx';
import JobResults from './JobResults.jsx';
import { RefreshCw, Clock, ChevronDown } from 'lucide-react';

function getProgress(steps = [], status) {
  if (status === 'done') return 100;
  if (status === 'failed') return 100;
  if (status === 'queued') return 0;
  // Estimate based on known step count (6 major steps)
  const totalExpected = 12;
  return Math.min(95, Math.round((steps.length / totalExpected) * 100));
}

export default function JobDetail({ jobId, initialJob, onRetry }) {
  const [liveJob, setLiveJob] = useState(initialJob || null);

  const polledJob = useJobPoller(
    // Only poll if not in terminal state
    liveJob?.status === 'done' || liveJob?.status === 'failed' ? null : jobId,
    (data) => setLiveJob(data)
  );

  const job = polledJob || liveJob;
  const progress = getProgress(job?.steps, job?.status);

  if (!job) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <p>Select a job to view details</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Job header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--white)', letterSpacing: '0.04em', marginBottom: 4 }}>
              Database Assignment
            </h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              Job ID: {job.id}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge badge-${job.status}`}>
              {job.status === 'running' && <span className="animate-pulse-red">●</span>}
              {job.status}
            </span>
            {job.status === 'failed' && (
              <button className="btn btn-ghost" onClick={() => onRetry?.(job)} style={{ fontSize: 11, padding: '5px 12px' }}>
                <RefreshCw size={11} /> Retry
              </button>
            )}
          </div>
        </div>

        {/* Scenario snippet */}
        <div style={{
          padding: '12px 14px',
          background: 'rgba(10, 2, 2, 0.7)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: 14,
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          marginBottom: 14,
        }}>
          "{job.payload?.scenario?.slice(0, 180) || 'University Management System'}..."
        </div>

        {/* Progress bar */}
        {(job.status === 'running' || job.status === 'queued') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {job.steps.length} steps completed
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--crimson-100)' }}>
                {progress}%
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="ornament" style={{ marginBottom: 20 }}>Live Log</div>

      {/* Step log */}
      <StepLog steps={job.steps} status={job.status} jobId={job.id} />

      {/* Results */}
      <JobResults job={job} />
    </div>
  );
}
