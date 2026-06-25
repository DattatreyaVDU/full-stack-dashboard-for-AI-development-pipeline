import { Code2, Webhook, Layers, Rocket, Clock, FolderOpen, Download, RefreshCw, Globe, Zap } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/cards/StatCard';
import PipelineTracker from '../components/panels/PipelineTracker';
import { DashboardState, DiskProject } from '../types';

interface Props { state: DashboardState; }

const SERVER = (typeof window !== 'undefined' && (window as any).__SERVER_URL__) || '';

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function typeColor(type: string) {
  if (type === 'wordpress') return { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', text: '#a78bfa' };
  if (type === 'react')     return { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)',  text: 'var(--accent-blue)' };
  return { bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', text: 'var(--text-muted)' };
}

function typeLabel(type: string) {
  if (type === 'wordpress') return 'WordPress';
  if (type === 'react')     return 'React';
  return 'Unknown';
}

async function downloadProject(projectName: string, setStatus: (s: string) => void) {
  if (!projectName) return;
  setStatus('downloading');
  try {
    const token = localStorage.getItem('n8n-auth-token') ?? '';
    const res = await fetch(`${SERVER}/api/download?project=${encodeURIComponent(projectName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
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

export default function DashboardPage({ state }: Props) {
  const { latestBuild, builds, pipeline } = state;
  const [dlStatus, setDlStatus]         = useState<string>('idle');
  const [selectedProject, setSelected]  = useState<string>('');
  const [diskProjects, setDiskProjects] = useState<DiskProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fetchProjects = useCallback(() => {
    setLoadingProjects(true);
    const token = localStorage.getItem('n8n-auth-token') ?? '';
    fetch(`${SERVER}/api/projects`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        const list: DiskProject[] = data.projects || [];
        setDiskProjects(list);
        // Only auto-select when nothing is selected yet
        setSelected(prev => (prev || list[0]?.name || ''));
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  // No external deps — reads token from localStorage directly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchProjects(); }, []);

  // Merge disk project list with in-memory build counts
  const buildsByProject = builds.reduce<Record<string, number>>((acc, b) => {
    if (b.projectName) acc[b.projectName] = (acc[b.projectName] || 0) + 1;
    return acc;
  }, {});

  const totalProjects  = diskProjects.length;
  const doneCount      = builds.filter(b => b.status === 'deployed').length;

  return (
    <div className="page-body">

      {/* ── Stat row ── */}
      <div className="stat-grid">
        <StatCard label="Builds Received"  value={builds.length}   sub="via n8n webhook"       accent="teal"   Icon={Webhook} />
        <StatCard label="Projects on Disk" value={totalProjects}   sub="detected in projects/"  accent="blue"   Icon={FolderOpen} />
        <StatCard label="Deployed"         value={doneCount}        sub="to EasyWP"              accent="purple" Icon={Rocket} />
        <StatCard
          label="Last Activity"
          value={latestBuild ? timeAgo(latestBuild.timestamp) : '—'}
          sub={latestBuild?.projectName ?? 'no builds yet'}
          accent="orange"
          Icon={Clock}
        />
      </div>

      {/* ── Download bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem', marginBottom: '1rem',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '7px',
          background: 'rgba(96,165,250,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Download size={14} style={{ color: 'var(--accent-blue)' }} />
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
          Download Project
        </span>

        <select
          value={selectedProject}
          onChange={e => setSelected(e.target.value)}
          style={{
            flex: 1, minWidth: '180px', maxWidth: '340px',
            padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)',
            border: '1.5px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
          }}
        >
          {diskProjects.length === 0
            ? <option value="">— no projects on disk —</option>
            : diskProjects.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name}  ({p.fileCount} files · {p.totalSizeFmt})
                </option>
              ))
          }
        </select>

        <button
          title="Refresh project list"
          onClick={fetchProjects}
          disabled={loadingProjects}
          className="btn btn-ghost btn-sm btn-icon"
        >
          <RefreshCw size={13} style={{ animation: loadingProjects ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>

        <button
          onClick={() => downloadProject(selectedProject, setDlStatus)}
          disabled={!selectedProject || dlStatus === 'downloading'}
          className={`btn btn-sm ${dlStatus === 'done' ? 'btn-primary' : 'btn-blue'}`}
          style={{ flexShrink: 0 }}
        >
          <Download size={12} />
          {dlStatus === 'downloading' ? 'Downloading…' : dlStatus === 'done' ? 'Downloaded ✓' : 'Download .zip'}
        </button>
      </div>

      {/* ── Pipeline ── */}
      <div className="mb-4">
        <PipelineTracker pipeline={pipeline} />
      </div>

      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>

        {/* ── Latest build ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Code2 size={13} />Latest Build</span>
            {latestBuild && (
              <span className={`badge badge-${latestBuild.status === 'error' ? 'error' : 'done'}`}>
                {latestBuild.status}
              </span>
            )}
          </div>
          {latestBuild ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  {latestBuild.projectName}
                </span>
                {latestBuild.projectName && (() => {
                  const t = latestBuild.projectName.startsWith('wp_') ? 'wordpress' : latestBuild.projectName.startsWith('web_') ? 'react' : 'unknown';
                  const c = typeColor(t);
                  return (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                      {typeLabel(t)}
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-idle" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                  page {latestBuild.pageId}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {latestBuild.pageName}
                </span>
              </div>
              <div style={{
                background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                padding: '0.625rem 0.75rem', fontSize: '0.73rem',
                color: 'var(--text-secondary)', maxHeight: '80px',
                overflow: 'hidden', fontFamily: 'var(--font-mono)', lineHeight: 1.6,
              }}>
                {latestBuild.content?.slice(0, 260) || '(empty)'}
                {(latestBuild.content?.length ?? 0) > 260 ? '…' : ''}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {timeAgo(latestBuild.timestamp)}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <Code2 size={28} className="empty-state-icon" />
              <div className="empty-state-title">No builds yet</div>
              <div className="empty-state-text">Run your n8n workflow to receive the first build.</div>
            </div>
          )}
        </div>

        {/* ── Recent builds ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Layers size={13} />Recent Builds</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{builds.length} total</span>
          </div>
          {builds.length > 0 ? (
            <ul className="activity-list">
              {builds.slice(0, 9).map(b => {
                const t = b.projectName?.startsWith('wp_') ? 'wordpress' : b.projectName?.startsWith('web_') ? 'react' : 'unknown';
                const c = typeColor(t);
                return (
                  <li key={b.id} className="activity-item">
                    <span className="activity-dot" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {b.projectName}
                      </div>
                      <div className="text-xs text-muted truncate">{b.pageName}</div>
                    </div>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                      borderRadius: '999px', background: c.bg, border: `1px solid ${c.border}`,
                      color: c.text, flexShrink: 0,
                    }}>
                      {typeLabel(t)}
                    </span>
                    <span className="activity-time">{timeAgo(b.timestamp)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-title">No activity</div>
              <div className="empty-state-text">Build history will appear here as n8n sends updates.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Disk Projects ── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <span className="card-title"><FolderOpen size={13} />Projects on Disk</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {loadingProjects ? 'scanning…' : `${diskProjects.length} found in projects/`}
          </span>
        </div>

        {diskProjects.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(256px, 1fr))', gap: '0.75rem' }}>
            {diskProjects.map(p => {
              const tc = typeColor(p.type);
              const builds_n = buildsByProject[p.name] || 0;
              return (
                <div key={p.name} style={{
                  padding: '1rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  transition: 'border-color var(--transition), box-shadow var(--transition)',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-bright)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)', wordBreak: 'break-all', lineHeight: 1.4,
                      }}>
                        {p.name}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, padding: '0.175rem 0.5rem',
                      borderRadius: '999px', background: tc.bg, border: `1px solid ${tc.border}`,
                      color: tc.text, flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      {typeLabel(p.type)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.875rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span><strong style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{p.fileCount}</strong> files</span>
                    <span><strong style={{ color: 'var(--text-secondary)' }}>{p.totalSizeFmt}</strong></span>
                    {builds_n > 0 && (
                      <span style={{ color: 'var(--accent-teal)' }}>
                        <strong>{builds_n}</strong> builds
                      </span>
                    )}
                  </div>

                  {p.lastModified && (
                    <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)' }}>
                      Modified {timeAgo(p.lastModified)}
                    </div>
                  )}

                  {p.topFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {p.topFiles.slice(0, 4).map(f => (
                        <span key={f} style={{
                          fontSize: '0.63rem', padding: '0.1rem 0.4rem',
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: '4px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                        }}>
                          {f}
                        </span>
                      ))}
                      {p.topFiles.length > 4 && (
                        <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{p.topFiles.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => { setSelected(p.name); downloadProject(p.name, setDlStatus); }}
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '0.25rem', fontSize: '0.75rem', gap: '0.35rem', alignSelf: 'flex-start' }}
                  >
                    <Download size={11} /> Download .zip
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '2.5rem' }}>
            <FolderOpen size={28} className="empty-state-icon" />
            <div className="empty-state-title">No projects on disk</div>
            <div className="empty-state-text">
              Projects appear here after your n8n workflow writes files to <code>projects/</code>.
            </div>
          </div>
        )}
      </div>

      {/* ── Pipeline setup hint (only when no builds at all) ── */}
      {builds.length === 0 && diskProjects.length === 0 && (
        <div className="card" style={{ borderColor: 'rgba(59,130,246,.25)' }}>
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--accent-blue)' }}>
              <Webhook size={13} />Quick Setup
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>1.</span>
            <span className="text-secondary">After <strong>File Creation Website</strong>, add an <strong>HTTP Request</strong> node.</span>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>2.</span>
            <span className="text-secondary">Method: <code>POST</code> — URL: <code style={{ color: 'var(--accent-blue)' }}>/api/webhook/n8n</code></span>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>3.</span>
            <span className="text-secondary">Body: send <code>content</code>, <code>page_id</code>, <code>page_name</code>, <code>project_name</code>, <code>carpeta</code>.</span>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>4.</span>
            <span className="text-secondary">Run the workflow — builds appear here instantly. Projects persist through restarts.</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
