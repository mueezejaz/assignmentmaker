import React, { useState } from 'react';
import {
  FileCode, FileText, Image, File, Download, Eye,
  ExternalLink, Package, CheckCircle
} from 'lucide-react';
import { fileDownloadUrl, fileViewUrl } from '../lib/api.js';

const FILE_META = {
  'erd.mmd':                  { icon: FileCode,  label: 'ERD Mermaid Source',       desc: 'Raw Mermaid diagram code',          color: '#7c4dff' },
  'erd.png':                  { icon: Image,     label: 'ERD Diagram (PNG)',         desc: 'Entity Relationship Diagram image', color: '#00b0ff' },
  'erd.svg':                  { icon: Image,     label: 'ERD Diagram (SVG)',         desc: 'Vector ERD diagram',                color: '#00b0ff' },
  'report.tex':               { icon: FileText,  label: 'LaTeX Document',            desc: 'Business scenario in LaTeX',        color: '#ff6d00' },
  'report.docx':              { icon: FileText,  label: 'Word Document (.docx)',     desc: 'Ready-to-submit Word document',     color: '#2196f3' },
  'create_database.py':       { icon: FileCode,  label: 'Python DB Script',          desc: 'Run on Windows to create .accdb',   color: '#ffeb3b' },
  'StudentAttendanceSystem.accdb': { icon: Package, label: 'MS Access Database',    desc: 'Functional .accdb database file',   color: '#e91e63' },
  'README.md':                { icon: FileText,  label: 'Instructions (README)',     desc: 'How to create the .accdb file',     color: '#4caf50' },
};

function getFileMeta(filename) {
  return FILE_META[filename] || {
    icon: File, label: filename, desc: 'Generated file', color: 'var(--ash-200)'
  };
}

function FileCard({ jobId, filename }) {
  const meta = getFileMeta(filename);
  const Icon = meta.icon;
  const downloadUrl = fileDownloadUrl(jobId, filename);
  const viewUrl = fileViewUrl(jobId, filename);
  const isImage = filename.endsWith('.png') || filename.endsWith('.svg');
  const isViewable = isImage || filename.endsWith('.tex') || filename.endsWith('.mmd') || filename.endsWith('.md') || filename.endsWith('.py');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 16px',
      background: 'rgba(15, 3, 3, 0.7)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      marginBottom: 10,
      transition: 'border-color 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(150,30,30,0.5)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 4,
        background: `${meta.color}20`,
        border: `1px solid ${meta.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--white)', letterSpacing: '0.03em' }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {filename}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{meta.desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {isViewable && (
          <a href={viewUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
            <Eye size={12} /> View
          </a>
        )}
        <a href={downloadUrl} download className="btn btn-gold" style={{ padding: '6px 14px', fontSize: 11 }}>
          <Download size={12} /> Download
        </a>
      </div>
    </div>
  );
}

export default function JobResults({ job }) {
  const [activeTab, setActiveTab] = useState('files');
  if (!job) return null;

  const files = job.result?.files ? Object.values(job.result.files) : [];
  const uniqueFiles = [...new Set(files)];

  return (
    <div style={{ marginTop: 24 }}>
      {job.status === 'done' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          background: 'rgba(20,60,30,0.3)',
          border: '1px solid rgba(50,130,70,0.4)',
          borderRadius: 4,
          marginBottom: 20,
        }}>
          <CheckCircle size={20} color="#5dba8a" />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#5dba8a', letterSpacing: '0.05em' }}>
              Assignment Generated Successfully
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {uniqueFiles.length} files created · Download all files below
            </div>
          </div>
        </div>
      )}

      {job.status === 'failed' && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(80,10,10,0.4)',
          border: '1px solid rgba(160,30,30,0.4)',
          borderRadius: 4,
          marginBottom: 20,
          color: 'var(--crimson-100)',
          fontSize: 14,
        }}>
          <strong style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>Generation Failed</strong>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>{job.error}</p>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Please check your Gemini API key or try again. If the problem persists, contact your administrator.
          </p>
        </div>
      )}

      {uniqueFiles.length > 0 && (
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={14} /> Generated Files
          </h3>
          {uniqueFiles.map(filename => (
            <FileCard key={filename} jobId={job.id} filename={filename} />
          ))}
        </div>
      )}

      {/* Python script instructions */}
      {uniqueFiles.includes('create_database.py') && (
        <div style={{
          marginTop: 20, padding: '16px 18px',
          background: 'rgba(10, 20, 5, 0.5)',
          border: '1px solid rgba(50, 100, 30, 0.3)',
          borderRadius: 4,
        }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#5dba8a', letterSpacing: '0.05em', marginBottom: 10 }}>
            ⚙️ To Generate the .accdb Database File
          </h4>
          <ol style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 2, paddingLeft: 18 }}>
            <li>Download <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash-200)' }}>create_database.py</code></li>
            <li>Transfer to a <strong style={{ color: 'var(--text)' }}>Windows machine</strong> with MS Access installed</li>
            <li>Install: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash-200)' }}>pip install pyodbc pywin32</code></li>
            <li>Run: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash-200)' }}>python create_database.py</code></li>
            <li><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash-200)' }}>StudentAttendanceSystem.accdb</code> will be created</li>
          </ol>
        </div>
      )}
    </div>
  );
}
