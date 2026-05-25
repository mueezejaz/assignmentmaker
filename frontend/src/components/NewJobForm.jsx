import React, { useState } from 'react';
import { Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { createJob } from '../lib/api.js';

const DEFAULT_SCENARIO = `University Management System for a mid-sized Pakistani university. 
The system manages student enrollment, faculty assignments, departmental structure, 
course scheduling across semesters, and tracks daily attendance. 
Key operations include registering students to courses, assigning teachers to sections, 
and recording attendance status (Present/Absent/Late) per student per class.`;

export default function NewJobForm({ onJobCreated }) {
  const [scenario, setScenario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    // FIX: Use the actual scenario value; only fall back to default if truly empty
    const trimmed = scenario.trim();
    const text = trimmed.length > 0 ? trimmed : DEFAULT_SCENARIO;
    setLoading(true);
    setError('');
    try {
      const data = await createJob(text);
      onJobCreated?.({ ...data, scenario: text });
      setScenario('');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--white)', letterSpacing: '0.06em', marginBottom: 6 }}>
          Generate Assignment
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Describe your university system and AI will generate the full database assignment.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--gold)', marginBottom: 8, textTransform: 'uppercase' }}>
            Business Scenario
          </label>
          <textarea
            className="input"
            placeholder={DEFAULT_SCENARIO}
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            rows={5}
            style={{ minHeight: 100 }}
          />
          {scenario.trim().length > 0 && (
            <p style={{ fontSize: 12, color: '#5dba8a', marginTop: 6 }}>
              ✓ Using your custom scenario ({scenario.trim().length} chars)
            </p>
          )}
          {scenario.trim().length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Leave blank to use the default University Management System scenario.
            </p>
          )}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 14,
            background: 'rgba(80,10,10,0.4)',
            border: '1px solid rgba(160,30,30,0.4)',
            borderRadius: 4,
            fontSize: 13,
            color: 'var(--crimson-100)',
          }}>
            ✗ {error}
          </div>
        )}

        {/* <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: 14 }}
        >
          {loading ? (
            <><span className="spinner" /> Creating Job...</>
          ) : (
            "Generate Full Assignment"
          )}
        </button> */}
      </form>

      {/* What gets generated */}
      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          What gets generated?
        </button>
        {expanded && (
          <div className="animate-fade-in" style={{ marginTop: 12, paddingLeft: 18 }}>
            {[
              ['1', 'Mermaid ERD code (.mmd)', 'Entity Relationship Diagram'],
              ['2', 'ERD image (.png / .svg)', 'Visual diagram of all tables'],
              ['3', 'LaTeX document (.tex)', 'Academic business scenario write-up'],
              ['4', 'Word document (.docx)', 'Ready-to-submit formatted report'],
              ['5', 'Python script (.py)', 'Creates the MS Access .accdb file'],
            ].map(([num, title, desc]) => (
              <div key={num} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--crimson-300)', width: 14, flexShrink: 0, paddingTop: 2 }}>{num}.</span>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>— {desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}