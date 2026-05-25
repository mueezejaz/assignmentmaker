import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk, SignIn } from '@clerk/clerk-react';
import { useMockAuth } from './hooks/useMockAuth.js';
import { setUserId, apiKeyStatus, listJobs, createJob } from './lib/api.js';
import Header from './components/Header.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import ApiKeyModal from './components/ApiKeyModal.jsx';
import NewJobForm from './components/NewJobForm.jsx';
import JobsSidebar from './components/JobsSidebar.jsx';
import JobDetail from './components/JobDetail.jsx';
import { Toast, useToast } from './components/Toast.jsx';

// ─── Real Clerk-based App ─────────────────────────────────────────────────
function ClerkApp() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="auth-screen">
        <SignIn routing="hash" afterSignInUrl="/" />
      </div>
    );
  }

  return <MainApp user={user} onSignOut={() => signOut()} />;
}

// ─── Mock Auth App ─────────────────────────────────────────────────────────
function MockApp() {
  const { user, signIn, signOut } = useMockAuth();

  if (!user) {
    return <AuthScreen onMockSignIn={() => signIn('dev@university.edu', 'Developer')} />;
  }

  return <MainApp user={user} onSignOut={signOut} />;
}

// ─── Main App (post-auth) ──────────────────────────────────────────────────
function MainApp({ user, onSignOut }) {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const userId = user?.id || user?.primaryEmailAddress?.emailAddress || 'anonymous';

  // Set user ID for all API calls
  useEffect(() => {
    setUserId(userId);
  }, [userId]);

  // Check API key status & load jobs on mount
  useEffect(() => {
    async function init() {
      try {
        const status = await apiKeyStatus();
        setHasApiKey(status.hasKey);
        if (!status.hasKey) {
          setShowApiKeyModal(true);
        }
      } catch { }

      setJobsLoading(true);
      try {
        const data = await listJobs();
        setJobs(data.jobs || []);
        // Auto-select most recent running or done job
        const recent = (data.jobs || []).find(j => j.status === 'running' || j.status === 'done');
        if (recent) setSelectedJob(recent);
      } catch { }
      setJobsLoading(false);
    }
    init();
  }, [userId]);

  // Refresh jobs list periodically (for background status)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await listJobs();
        setJobs(data.jobs || []);
      } catch { }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // FIX: onJobCreated now receives { jobId, status, scenario } from NewJobForm
  function handleJobCreated({ jobId, status, scenario }) {
    const fakeJob = {
      id: jobId,
      type: 'generate-assignment',
      status: status || 'queued',
      steps: [],
      createdAt: Date.now(),
      payload: { scenario: scenario || '' },
    };
    setJobs(prev => [fakeJob, ...prev]);
    setSelectedJob(fakeJob);
    addToast('Job created! Watch live progress in the panel →', 'info');
  }

  function handleJobUpdate(updatedJob) {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    if (selectedJob?.id === updatedJob.id) {
      setSelectedJob(updatedJob);
    }
    if (updatedJob.status === 'done') {
      addToast('Assignment generated successfully!', 'success');
    } else if (updatedJob.status === 'failed') {
      addToast(`Job failed: ${updatedJob.error}`, 'error');
    }
  }

  async function handleRetry(job) {
    try {
      const scenario = job.payload?.scenario || '';
      const data = await createJob(scenario);
      handleJobCreated({ ...data, scenario });
    } catch (err) {
      addToast(`Retry failed: ${err.message}`, 'error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        user={user}
        onSignOut={onSignOut}
        onManageKey={() => setShowApiKeyModal(true)}
        hasApiKey={hasApiKey}
      />

      {showApiKeyModal && (
        <ApiKeyModal
          onSuccess={() => {
            setHasApiKey(true);
            setShowApiKeyModal(false);
            addToast('Gemini API key saved!', 'success');
          }}
          onSkip={hasApiKey ? () => setShowApiKeyModal(false) : null}
        />
      )}

      <div className="app-layout" style={{ flex: 1 }}>
        <aside className="sidebar">
          <NewJobForm onJobCreated={handleJobCreated} />
          <JobsSidebar
            jobs={jobs}
            selectedId={selectedJob?.id}
            onSelect={job => setSelectedJob(job)}
            loading={jobsLoading}
          />
        </aside>

        <main className="main-panel">
          {selectedJob ? (
            <JobDetail
              key={selectedJob.id}
              jobId={selectedJob.id}
              initialJob={selectedJob}
              onRetry={handleRetry}
              onUpdate={handleJobUpdate}
            />
          ) : (
            <WelcomePanel hasApiKey={hasApiKey} onSetKey={() => setShowApiKeyModal(true)} />
          )}
        </main>
      </div>

      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function WelcomePanel({ hasApiKey, onSetKey }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.15 }}>⚗️</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--white)', letterSpacing: '0.06em', marginBottom: 12 }}>
        Ready to Generate
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Create a new assignment job using the panel on the left.
        The AI will generate your complete university database assignment including
        ERD diagrams, LaTeX documentation, and Python code.
      </p>
      {!hasApiKey && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(80,50,0,0.3)',
          border: '1px solid rgba(180,130,0,0.3)',
          borderRadius: 4,
          marginBottom: 20,
        }}>
          <p style={{ color: 'var(--gold)', fontSize: 14, marginBottom: 10 }}>
            ⚠ Gemini API key not configured
          </p>
          <button className="btn btn-gold" onClick={onSetKey} style={{ fontSize: 12 }}>
            Set API Key to Begin
          </button>
        </div>
      )}
      <div className="tag-strip" style={{ justifyContent: 'center' }}>
        {['Mermaid ERD', 'LaTeX Doc', 'DOCX Report', 'Python Script', 'Live Updates'].map(t => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────
export default function App({ mockAuth = false }) {
  return mockAuth ? <MockApp /> : <ClerkApp />;
}