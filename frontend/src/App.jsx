import React, { useState, useEffect } from 'react';
import { setApiKeyHeader, listJobs, createJob, apiKeyStatus, setApiKey, getJob } from './lib/api.js';
import ApiKeyScreen from './components/ApiKeyScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import GenerateForm from './components/GenerateForm.jsx';
import JobDetail from './components/JobDetail.jsx';
import { Toast, useToast } from './components/Toast.jsx';

export default function App() {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [authed, setAuthed] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    if (!apiKey) return;
    setApiKeyHeader(apiKey);

    apiKeyStatus()
      .then(status => {
        if (status.hasKey) {
          setAuthed(true);
          loadJobs();
        } else {
          setApiKey(apiKey)
            .then(() => { setAuthed(true); loadJobs(); })
            .catch(() => {
              localStorage.removeItem('gemini_api_key');
              setApiKeyState('');
            });
        }
      })
      .catch(() => {
        localStorage.removeItem('gemini_api_key');
        setApiKeyState('');
      });
  }, []);

  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(loadJobs, 15000);
    return () => clearInterval(interval);
  }, [authed]);

  // Close drawer on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 640) setDrawerOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  async function loadJobs() {
    try {
      const data = await listJobs();
      setJobs(data.jobs || []);
    } catch { }
  }

  function handleAuth(key) {
    setApiKeyState(key);
    setAuthed(true);
    loadJobs();
  }

  function handleJobCreated({ jobId, status, scenario }) {
    const fakeJob = {
      id: jobId,
      type: 'generate-assignment',
      status: status || 'queued',
      steps: [],
      createdAt: Date.now(),
      payload: { scenario },
    };
    setJobs(prev => [fakeJob, ...prev]);
    setSelectedJob(fakeJob);
    setShowForm(false);
    setDrawerOpen(false);
    addToast('Job started! Watching live progress…', 'info');
  }

  async function handleJobUpdate(updatedJob) {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    if (selectedJob?.id === updatedJob.id) setSelectedJob(updatedJob);
    if (updatedJob.status === 'done') {
      addToast('Assignment ready to download!', 'success');
      try {
        const fresh = await getJob(updatedJob.id);
        if (fresh) {
          setSelectedJob(fresh);
          setJobs(prev => prev.map(j => j.id === fresh.id ? fresh : j));
        }
      } catch { }
    }
    if (updatedJob.status === 'failed') addToast('Job failed. Please try again.', 'error');
  }

  async function handleSelectJob(job) {
    setSelectedJob(job);
    setShowForm(false);
    setDrawerOpen(false); // close drawer on mobile after selecting
    if (job.status === 'done' || job.status === 'failed') {
      try {
        const fresh = await getJob(job.id);
        if (fresh) setSelectedJob(fresh);
      } catch { }
    }
  }

  function handleNewJob() {
    setSelectedJob(null);
    setShowForm(true);
    setDrawerOpen(false); // close drawer on mobile
  }

  function handleSignOut() {
    localStorage.removeItem('gemini_api_key');
    setApiKeyState('');
    setAuthed(false);
    setJobs([]);
    setSelectedJob(null);
  }

  if (!authed) {
    return <ApiKeyScreen onAuth={handleAuth} />;
  }

  const activeView = showForm || !selectedJob ? 'generate' : 'job';

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Hamburger — mobile only */}
          <button
            className="hamburger-btn"
            onClick={() => setDrawerOpen(v => !v)}
            aria-label="Open sidebar"
          >
            <span className={`hamburger-icon ${drawerOpen ? 'open' : ''}`}>
              <span /><span /><span />
            </span>
          </button>
          <div className="logo">
            <div className="logo-mark">U</div>
            UniGen
            <span className="logo-sub">DB GENERATOR</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="header-api-status" style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
            ●{' '}<span style={{ color: 'var(--teal)' }}>API key active</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay (dim behind open sidebar) */}
      <div
        className={`mobile-drawer-overlay ${drawerOpen ? 'visible' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Main layout */}
      <div className="main-layout" style={{ flex: 1 }}>
        <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
          {/* Mobile close button inside drawer */}
          <div className="sidebar-close-btn" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', letterSpacing: '0.04em' }}>
              Jobs
            </span>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}
            >
              ×
            </button>
          </div>
          <Sidebar
            jobs={jobs}
            selectedId={selectedJob?.id}
            onSelect={handleSelectJob}
            onNewJob={handleNewJob}
          />
        </aside>

        <main className="main-area">
          {showForm || !selectedJob ? (
            <GenerateForm onJobCreated={handleJobCreated} />
          ) : (
            <JobDetail
              key={selectedJob.id}
              job={selectedJob}
              onUpdate={handleJobUpdate}
            />
          )}
        </main>
      </div>

      {/* Mobile bottom nav bar */}
      <nav className="mobile-nav-bar">
        <button
          className={`mobile-nav-btn ${activeView === 'generate' ? 'active' : ''}`}
          onClick={handleNewJob}
        >
          <span className="mobile-nav-icon">⚡</span>
          Generate
        </button>

        <button
          className={`mobile-nav-btn ${activeView === 'job' ? 'active' : ''}`}
          onClick={() => {
            if (selectedJob) { setShowForm(false); }
          }}
          disabled={!selectedJob}
          style={{ opacity: selectedJob ? 1 : 0.35 }}
        >
          <span className="mobile-nav-icon">📋</span>
          Current
        </button>

        <button
          className={`mobile-nav-btn ${drawerOpen ? 'active' : ''}`}
          onClick={() => setDrawerOpen(v => !v)}
        >
          <span className="mobile-nav-icon">🗂️</span>
          Jobs {jobs.length > 0 && `(${jobs.length})`}
        </button>

        <button
          className="mobile-nav-btn"
          onClick={handleSignOut}
        >
          <span className="mobile-nav-icon">🚪</span>
          Sign out
        </button>
      </nav>

      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  );
}