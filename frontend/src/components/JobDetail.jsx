import React, { useState } from 'react';
import { useJobPoller } from '../hooks/useJobPoller.js';
import { downloadFile } from '../lib/api.js';

const FILE_INFO = {
  'erd_chen.png': { icon: '🔷', label: 'Chen Notation ERD', desc: 'Entity-relationship diagram (Chen style)', color: 'rgba(54,173,163,0.15)', border: 'rgba(54,173,163,0.3)' },
  'erd_chen.svg': { icon: '🔷', label: 'Chen Notation ERD', desc: 'Entity-relationship diagram (Chen style, SVG)', color: 'rgba(54,173,163,0.15)', border: 'rgba(54,173,163,0.3)' },
  'erd.png': { icon: '🔵', label: "Crow's Foot ERD", desc: "Entity-relationship diagram (Crow's foot style)", color: 'rgba(47,87,138,0.2)', border: 'rgba(47,87,138,0.4)' },
  'erd.svg': { icon: '🔵', label: "Crow's Foot ERD", desc: "Entity-relationship diagram (SVG)", color: 'rgba(47,87,138,0.2)', border: 'rgba(47,87,138,0.4)' },
  'report.docx': { icon: '📄', label: 'Assignment Report', desc: 'Full Word document with schema & normalization', color: 'rgba(35,47,114,0.2)', border: 'rgba(35,47,114,0.4)' },
};

const ACCDB_INFO = { icon: '🗄️', label: 'MS Access Database', desc: '.accdb database file', color: 'rgba(54,173,163,0.1)', border: 'rgba(54,173,163,0.3)' };

// Priority order for display — only these 4 types shown
const WANTED = ['erd_chen.png', 'erd_chen.svg', 'erd.png', 'erd.svg', 'report.docx'];

/**
 * Extract all unique file values from the files map.
 * The worker stores: { erdImage: 'erd.png', erdChen: 'erd_chen.png', docx: 'report.docx', ... }
 * job.json on disk has the same shape under the top-level `files` key.
 * The BullMQ returnvalue wraps it as { files: {...}, jobDir: '...' }
 * So we check both job.result?.files and job.files directly.
 */
function extractFileValues(job) {
  const src = job?.result?.files || job?.files || {};
  // values are the actual filenames e.g. 'erd.png'
  return Object.values(src).filter(Boolean);
}

function FileCard({ jobId, filename, info }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleDownload() {
    setLoading(true); setErr('');
    try { await downloadFile(jobId, filename); }
    catch (e) { setErr('Download failed — check console'); }
    finally { setLoading(false); }
  }

  return (
    <div className="file-card">
      <div className="file-icon" style={{ background: info.color, border: `1px solid ${info.border}` }}>
        {info.icon}
      </div>
      <div className="file-info">
        <div className="file-name">{info.label}</div>
        <div className="file-desc">{filename}</div>
        {err && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 2 }}>{err}</div>}
      </div>
      <button className="btn btn-outline btn-sm" onClick={handleDownload} disabled={loading}>
        {loading ? <span className="spinner" /> : '↓'} Download
      </button>
    </div>
  );
}

function getProgress(steps = [], status) {
  if (status === 'done' || status === 'failed') return 100;
  if (status === 'queued') return 0;
  return Math.min(95, Math.round((steps.length / 14) * 100));
}

function formatTs(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function JobDetail({ job: initialJob, onUpdate }) {
  const [job, setJob] = useState(initialJob);

  useJobPoller(
    job?.status === 'done' || job?.status === 'failed' ? null : job?.id,
    (data) => { setJob(data); onUpdate?.(data); }
  );

  if (!job) return null;

  const steps = job.steps || [];
  const progress = getProgress(steps, job.status);

  // Get all available file values (the actual filenames)
  const allFiles = extractFileValues(job);

  // Files we want to show, in priority order, deduped (prefer .png over .svg)
  const shownFiles = [];
  // Track which "type" we've already added to avoid showing both png and svg of same diagram
  const typeSeen = new Set();
  for (const fname of WANTED) {
    const typeKey = fname.replace(/\.(png|svg)$/, ''); // e.g. 'erd_chen', 'erd', 'report'
    if (!typeSeen.has(typeKey) && allFiles.includes(fname)) {
      shownFiles.push(fname);
      typeSeen.add(typeKey);
    }
  }

  // .accdb file (any filename ending in .accdb)
  const accdbFile = allFiles.find(f => f && f.endsWith('.accdb'));

  const hasReadme = allFiles.includes('README.md');
  const totalShown = shownFiles.length + (accdbFile ? 1 : 0);

  return (
    <div className="job-detail animate-in">
      <div className="job-header">
        <div className="job-title-area">
          <h2>Database Assignment</h2>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
            ID: {job.id}
          </div>
        </div>
        <span className={`badge badge-${job.status}`}>
          {job.status === 'running' && <span className="dot-running" />}
          {job.status}
        </span>
      </div>

      {job.payload?.scenario && (
        <div className="job-scenario">
          "{job.payload.scenario.slice(0, 200)}{job.payload.scenario.length > 200 ? '...' : ''}"
        </div>
      )}

      {(job.status === 'running' || job.status === 'queued') && (
        <div className="progress-wrap">
          <div className="progress-info">
            <span>{steps.length} steps completed</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
        Live Progress
      </div>
      <div className="step-log">
        {steps.length === 0 ? (
          <span style={{ color: 'var(--text-dim)' }}>Waiting to start...</span>
        ) : steps.map((step, i) => (
          <div key={i} className="step-row">
            <span className="step-ts">{formatTs(step.ts)}</span>
            <span className="step-icon">
              {i < steps.length - 1 || job.status === 'done' ? '✓' :
                step.state === 'error' ? '✗' : '▸'}
            </span>
            <span className={`step-msg ${(i < steps.length - 1 || job.status === 'done') && job.status !== 'failed' ? 'done' : step.state === 'error' ? 'error' : ''}`}>
              {step.message}
              {i === steps.length - 1 && job.status === 'running' && (
                <span className="pulse" style={{ marginLeft: 6, color: 'var(--teal)' }}>▮</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {job.status === 'done' && (
        <div className="files-section animate-in">
          <div className="banner banner-success">
            ✓ Assignment generated successfully — {totalShown} file{totalShown !== 1 ? 's' : ''} ready to download
          </div>

          <div className="files-title">⬇ Download Files</div>

          {shownFiles.length === 0 && !accdbFile && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
              No downloadable files found. The job completed but files may have been saved under different names.
              <br />
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                Available: {allFiles.join(', ') || 'none'}
              </span>
            </div>
          )}

          {shownFiles.map(fname => (
            <FileCard key={fname} jobId={job.id} filename={fname} info={FILE_INFO[fname]} />
          ))}

          {accdbFile && (
            <FileCard jobId={job.id} filename={accdbFile} info={ACCDB_INFO} />
          )}

          {!accdbFile && hasReadme && (
            <div className="banner banner-info" style={{ marginTop: 8, fontSize: 13 }}>
              ℹ The .accdb file requires Windows + MS Access. Run the downloaded Python script on Windows to generate it.
            </div>
          )}
        </div>
      )}

      {job.status === 'failed' && (
        <div className="banner banner-error" style={{ flexDirection: 'column', gap: 6 }}>
          <strong>Generation failed</strong>
          <span style={{ fontSize: 13, opacity: 0.8 }}>{job.error}</span>
        </div>
      )}
    </div>
  );
}