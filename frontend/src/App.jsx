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
    addToast('Job started! Watching live progress…', 'info');
  }

  async function handleJobUpdate(updatedJob) {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    if (selectedJob?.id === updatedJob.id) setSelectedJob(updatedJob);
    if (updatedJob.status === 'done') {
      addToast('Assignment ready to download!', 'success');
      // Re-fetch to ensure result.files is fully populated
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
    // Re-fetch to get full result.files data for completed jobs
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

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <div className="logo-mark">U</div>
          UniGen
          <span className="logo-sub">DB GENERATOR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
            ●{' '}<span style={{ color: 'var(--teal)' }}>API key active</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="main-layout" style={{ flex: 1 }}>
        <aside className="sidebar">
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

      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  );
}