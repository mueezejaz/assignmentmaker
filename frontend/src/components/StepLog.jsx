import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Loader } from 'lucide-react';

function stepIcon(state) {
  switch (state) {
    case 'done':    return <CheckCircle size={12} color="#5dba8a" />;
    case 'error':   return <XCircle size={12} color="var(--crimson-100)" />;
    case 'warning': return <AlertTriangle size={12} color="var(--gold)" />;
    case 'queued':  return <Clock size={12} color="var(--ash-400)" />;
    default:        return <Loader size={12} color="var(--ash-200)" style={{ animation: 'spin 1s linear infinite' }} />;
  }
}

function formatTs(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function StepLog({ steps = [], status, jobId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps.length]);

  if (!steps.length) {
    return (
      <div className="step-log" style={{ color: 'var(--ash-400)', textAlign: 'center', padding: '24px' }}>
        <Clock size={18} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
        Waiting for job to start...
      </div>
    );
  }

  return (
    <div className="step-log">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const state = step.state || 'running';
        return (
          <div key={i} className={`step-line ${state} animate-fade-in`}
            style={{ animationDelay: `${i * 0.05}s` }}>
            <span className="step-ts">{formatTs(step.ts)}</span>
            {stepIcon(state)}
            <span className="step-msg">
              {step.message}
              {isLast && (status === 'running') && (
                <span className="animate-pulse-red" style={{ marginLeft: 6 }}>▮</span>
              )}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
