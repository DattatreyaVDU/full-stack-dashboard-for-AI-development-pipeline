import { Code2, Webhook, Layers, Rocket, Clock, FolderOpen, Download, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import StatCard from '../components/cards/StatCard';
import PipelineTracker from '../components/panels/PipelineTracker';
import { DashboardState } from '../types';

interface Props { state: DashboardState; }

const SERVER = (typeof window !== 'undefined' && (window as any).__SERVER_URL__) || 'http://localhost:3001';

async function downloadProject(projectName: string, setStatus: (s: string) => void) {
  if (!projectName) return;
  setStatus('downloading');
  try {
    const res = await fetch(`${SERVER}/api/download?project=${encodeURIComponent(projectName)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      alert(`Download failed: ${err.error || res.statusText}`);
      setStatus('idle');
      return;
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${projectName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('done');
    setTimeout(() => setStatus('idle'), 3000);
  } catch (e: any) {
    alert(`Download error: ${e.message}`);
    setStatus('idle');
  }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function DashboardPage({ state }: Props) {
  const { latestBuild, builds, pipeline } = state;
  const [dlStatus, setDlStatus]           = useState<string>('idle');
  const [projects, setProjects]           = useState<string[]>([]);
  const [selectedProject, setSelected]   = useState<string>('');

  const doneCount    = builds.filter(b => b.status === 'deployed').length;
  const pagesCount   = builds.length;
  const projectsSet  = new Set(builds.map(b => b.projectName));

  const fetchProjects = () => {
    fetch(`${SERVER}/api/download/list`)
      .then(r => r.json())
      .then(data => {
        const names: string[] = (data.projects || []).map((p: any) => p.name);
        setProjects(names);
        if (names.length > 0 && !selectedProject) setSelected(names[0]);
      })
      .catch(() => {});
  };

  useEffect(() => { fetchProjects(); }, []);

  return (
    <div className="page-body">
      {/* Stat row */}
      <div className="stat-grid">
        <StatCard label="Builds Received"  value={pagesCount}         sub="via n8n webhook"        accent="teal"   Icon={Webhook} />
        <StatCard label="Projects"         value={projectsSet.size}   sub="unique project names"   accent="blue"   Icon={FolderOpen} />
        <StatCard label="Deployed"         value={doneCount}          sub="to EasyWP"              accent="purple" Icon={Rocket} />
        <StatCard
          label="Last Activity"
          value={latestBuild ? timeAgo(latestBuild.timestamp) : '—'}
          sub={latestBuild?.pageName ?? 'no builds yet'}
          accent="orange"
          Icon={Clock}
        />
      </div>

      {/* Download bar — always visible */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '0.65rem 1rem', marginBottom: '1rem',
      }}>
        <Download size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
          Download Project Files
        </span>

        <select
          value={selectedProject}
          onChange={e => setSelected(e.target.value)}
          style={{
            flex: 1, minWidth: '180px', maxWidth: '340px',
            padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {projects.length === 0
            ? <option value="">— no projects yet —</option>
            : projects.map(p => <option key={p} value={p}>{p}</option>)
          }
        </select>

        <button
          title="Refresh project list"
          onClick={fetchProjects}
          style={{
            display: 'flex', alignItems: 'center', padding: '0.35rem',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} />
        </button>

        <button
          onClick={() => downloadProject(selectedProject, setDlStatus)}
          disabled={!selectedProject || dlStatus === 'downloading'}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: (!selectedProject || dlStatus === 'downloading') ? 'not-allowed' : 'pointer',
            background: dlStatus === 'done' ? 'var(--accent-teal)' : 'var(--accent-blue)',
            color: '#fff', fontSize: '0.8125rem', fontWeight: 600,
            opacity: (!selectedProject || dlStatus === 'downloading') ? 0.5 : 1,
            transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          <Download size={13} />
          {dlStatus === 'downloading' ? 'Downloading…' : dlStatus === 'done' ? 'Downloaded ✓' : 'Download .zip'}
        </button>
      </div>

      {/* Pipeline */}
      <div className="mb-4">
        <PipelineTracker pipeline={pipeline} />
      </div>

      <div className="grid-2">
        {/* Latest build card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Code2 size={13} />Latest Build</span>
          </div>
          {latestBuild ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latestBuild.projectName}</span>
                <span className={`badge badge-${latestBuild.status === 'received' ? 'running' : latestBuild.status === 'error' ? 'error' : 'done'}`}>
                  {latestBuild.status}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <span className="badge badge-idle" style={{ fontFamily: 'var(--font-mono)' }}>
                  ID: {latestBuild.pageId}
                </span>
                <span className="text-xs text-secondary">{latestBuild.pageName}</span>
              </div>
              <div className="text-xs text-muted font-mono mb-3">
                {latestBuild.filePath || 'No file path'}
              </div>
              <div
                style={{
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  maxHeight: '90px',
                  overflow: 'hidden',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.6,
                }}
              >
                {latestBuild.content?.slice(0, 280) || '(empty)'}
                {latestBuild.content?.length > 280 ? '...' : ''}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <Code2 size={32} className="empty-state-icon" />
              <div className="empty-state-title">No builds yet</div>
              <div className="empty-state-text">Trigger your n8n workflow to receive the first build.</div>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Layers size={13} />Recent Builds</span>
          </div>
          {builds.length > 0 ? (
            <ul className="activity-list">
              {builds.slice(0, 8).map(b => (
                <li key={b.id} className="activity-item">
                  <span className="activity-dot" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {b.projectName}
                    </div>
                    <div className="text-xs text-muted truncate">{b.pageName}</div>
                  </div>
                  <span className="activity-time">{timeAgo(b.timestamp)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-title">No activity</div>
              <div className="empty-state-text">Build history will appear here.</div>
            </div>
          )}
        </div>
      </div>

      {/* Quick setup instructions */}
      {builds.length === 0 && (
        <div className="card mt-auto" style={{ marginTop: '1.25rem', borderColor: 'rgba(59,130,246,.25)' }}>
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--accent-blue)' }}>
              <Webhook size={13} />Quick Setup — Add this to your n8n workflow
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>1.</span>
            <span className="text-secondary">After your <strong>File Creation Website</strong> node, add an <strong>HTTP Request</strong> node.</span>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>2.</span>
            <span className="text-secondary">Set Method: <code>POST</code> — URL: <code style={{ color: 'var(--accent-blue)' }}>http://YOUR_SERVER:3001/api/webhook/n8n</code></span>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>3.</span>
            <span className="text-secondary">Body: send <code>content</code>, <code>page_id</code>, <code>page_name</code>, <code>project_name</code>, <code>archivo_creado</code>.</span>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>4.</span>
            <span className="text-secondary">Run the workflow — the build will appear here instantly.</span>
          </div>
        </div>
      )}
    </div>
  );
}
