import {
  Code2, Webhook, Layers, Rocket, Clock, FolderOpen, Download,
  RefreshCw, Globe, Zap, TrendingUp, Activity, Box, ArrowRight,
  ChevronRight, Sparkles,
} from 'lucide-react';
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
  if (type === 'wordpress') return { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)',  text: '#a78bfa' };
  if (type === 'react')     return { bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)',  text: 'var(--accent-blue)' };
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
  const [dlStatus, setDlStatus]           = useState<string>('idle');
  const [selectedProject, setSelected]    = useState<string>('');
  const [diskProjects, setDiskProjects]   = useState<DiskProject[]>([]);
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
        setSelected(prev => (prev || list[0]?.name || ''));
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchProjects(); }, []);

  const buildsByProject = builds.reduce<Record<string, number>>((acc, b) => {
    if (b.projectName) acc[b.projectName] = (acc[b.projectName] || 0) + 1;
    return acc;
  }, {});

  const totalProjects = diskProjects.length;
  const doneCount     = builds.filter(b => b.status === 'deployed').length;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page-body">

      {/* ── Hero banner ───────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(45,212,191,0.07) 0%, rgba(96,165,250,0.07) 50%, rgba(167,139,250,0.05) 100%)',
        border: '1px solid rgba(45,212,191,0.15)',
        borderRadius: 'var(--radius-lg, 14px)',
        padding: '1.375rem 1.625rem',
        marginBottom: '1.375rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 180, height: 180,
          background: 'radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          width: 48, height: 48, borderRadius: '14px', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(45,212,191,0.25)',
        }}>
          <Sparkles size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{
            margin: 0, fontSize: '1.1rem', fontWeight: 800,
            color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>
            {greeting} 👋
          </h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {builds.length > 0
              ? `${builds.length} build${builds.length !== 1 ? 's' : ''} received · ${totalProjects} project${totalProjects !== 1 ? 's' : ''} on disk · last activity ${latestBuild ? timeAgo(latestBuild.timestamp) : '—'}`
              : 'Your n8n AI pipeline dashboard. Run a workflow to see builds appear here.'}
          </p>
        </div>
        {builds.length > 0 && (
          <div style={{
            display: 'flex', gap: '1.5rem', flexShrink: 0,
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-teal)', lineHeight: 1 }}>{builds.length}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Builds</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1 }}>{totalProjects}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Projects</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-purple)', lineHeight: 1 }}>{doneCount}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deployed</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stat row ──────────────────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: '1.375rem' }}>
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

      {/* ── Download toolbar ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.25rem',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '8px',
          background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Download size={14} style={{ color: 'var(--accent-blue)' }} />
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
          Download Project
        </span>
        <div style={{ flex: 1, minWidth: '180px', maxWidth: '360px', position: 'relative' }}>
          <select
            value={selectedProject}
            onChange={e => setSelected(e.target.value)}
            style={{
              width: '100%',
              padding: '0.375rem 0.625rem', borderRadius: 'var(--radius-sm)',
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
        </div>
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
          {dlStatus === 'downloading' ? 'Downloading…' : dlStatus === 'done' ? '✓ Downloaded' : 'Download .zip'}
        </button>
      </div>

      {/* ── Pipeline tracker ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <PipelineTracker pipeline={pipeline} />
      </div>

      {/* ── Latest build + Recent builds ──────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>

        {/* Latest build */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  {latestBuild.projectName}
                </span>
                {latestBuild.projectName && (() => {
                  const t = latestBuild.projectName.startsWith('wp_') ? 'wordpress' : latestBuild.projectName.startsWith('web_') ? 'react' : 'unknown';
                  const c = typeColor(t);
                  return (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                      {typeLabel(t)}
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: '999px',
                  background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)',
                  color: 'var(--accent-teal)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                }}>
                  page {latestBuild.pageId}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
                  {latestBuild.pageName}
                </span>
              </div>
              <div style={{
                background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                padding: '0.75rem', fontSize: '0.73rem',
                color: 'var(--text-secondary)', maxHeight: '80px',
                overflow: 'hidden', fontFamily: 'var(--font-mono)', lineHeight: 1.6,
                border: '1px solid var(--border)',
              }}>
                {latestBuild.content?.slice(0, 260) || '(empty)'}
                {(latestBuild.content?.length ?? 0) > 260 ? '…' : ''}
              </div>
              <div style={{ marginTop: '0.625rem', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={10} /> {timeAgo(latestBuild.timestamp)}
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

        {/* Recent builds activity list */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Activity size={13} />Recent Builds</span>
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
              background: builds.length > 0 ? 'rgba(45,212,191,0.1)' : 'transparent',
              border: builds.length > 0 ? '1px solid rgba(45,212,191,0.2)' : 'none',
              color: builds.length > 0 ? 'var(--accent-teal)' : 'var(--text-muted)',
            }}>
              {builds.length} total
            </span>
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
              <Layers size={24} className="empty-state-icon" />
              <div className="empty-state-title">No activity</div>
              <div className="empty-state-text">Build history will appear here as n8n sends updates.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Projects on Disk ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <span className="card-title"><FolderOpen size={13} />Projects on Disk</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {loadingProjects && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> scanning…
              </span>
            )}
            {!loadingProjects && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {diskProjects.length} found in <code style={{ fontSize: '0.68rem' }}>projects/</code>
              </span>
            )}
            <button className="btn btn-ghost btn-sm btn-icon" onClick={fetchProjects} title="Refresh">
              <RefreshCw size={12} style={{ animation: loadingProjects ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {diskProjects.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {diskProjects.map(p => {
              const tc       = typeColor(p.type);
              const builds_n = buildsByProject[p.name] || 0;
              return (
                <ProjectCard
                  key={p.name}
                  p={p}
                  tc={tc}
                  builds_n={builds_n}
                  onDownload={() => { setSelected(p.name); downloadProject(p.name, setDlStatus); }}
                  downloading={dlStatus === 'downloading' && selectedProject === p.name}
                />
              );
            })}
          </div>
        ) : loadingProjects ? (
          <SkeletonGrid />
        ) : (
          <div className="empty-state" style={{ padding: '2.5rem' }}>
            <FolderOpen size={32} className="empty-state-icon" />
            <div className="empty-state-title">No projects on disk</div>
            <div className="empty-state-text">
              Projects appear here after your n8n workflow writes files to <code>projects/</code>.
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Setup hint ──────────────────────────────────────────────── */}
      {builds.length === 0 && diskProjects.length === 0 && (
        <div className="card" style={{ borderColor: 'rgba(59,130,246,.2)', background: 'rgba(59,130,246,0.03)' }}>
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--accent-blue)' }}>
              <Webhook size={13} /> Quick Setup
            </span>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              color: 'var(--accent-blue)',
            }}>
              4 steps
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {[
              { n: 1, text: <>After <strong>File Creation Website</strong>, add an <strong>HTTP Request</strong> node.</> },
              { n: 2, text: <>Method: <code>POST</code> — URL: <code style={{ color: 'var(--accent-blue)' }}>/api/webhook/n8n</code></> },
              { n: 3, text: <>Body: send <code>content</code>, <code>page_id</code>, <code>page_name</code>, <code>project_name</code>, <code>carpeta</code>.</> },
              { n: 4, text: <>Run the workflow — builds appear here instantly. Projects persist through restarts.</> },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-teal)',
                }}>
                  {n}
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '2px' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}

// ── Project Card ────────────────────────────────────────────────────────────────

function ProjectCard({ p, tc, builds_n, onDownload, downloading }: {
  p: DiskProject;
  tc: { bg: string; border: string; text: string };
  builds_n: number;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1rem', background: 'var(--bg-surface)',
        border: `1px solid ${hovered ? tc.border : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered ? `0 4px 20px ${tc.bg.replace('0.12', '0.15')}` : 'none',
        animation: 'fadeUp 0.25s ease both',
      }}
    >
      {/* Name + type badge */}
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

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)',
        padding: '0.375rem 0.5rem',
        background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Box size={10} style={{ opacity: 0.6 }} />
          <strong style={{ color: 'var(--text-secondary)' }}>{p.fileCount}</strong> files
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <TrendingUp size={10} style={{ opacity: 0.6 }} />
          <strong style={{ color: 'var(--text-secondary)' }}>{p.totalSizeFmt}</strong>
        </span>
        {builds_n > 0 && (
          <span style={{ color: 'var(--accent-teal)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Zap size={10} />
            <strong>{builds_n}</strong> builds
          </span>
        )}
      </div>

      {/* Last modified */}
      {p.lastModified && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={10} /> Modified {timeAgo(p.lastModified)}
        </div>
      )}

      {/* Top files */}
      {p.topFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {p.topFiles.slice(0, 4).map(f => (
            <span key={f} style={{
              fontSize: '0.62rem', padding: '0.1rem 0.4rem',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '4px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            }}>
              {f}
            </span>
          ))}
          {p.topFiles.length > 4 && (
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              +{p.topFiles.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Download button */}
      <button
        onClick={onDownload}
        disabled={downloading}
        className="btn btn-ghost btn-sm"
        style={{ marginTop: '0.125rem', fontSize: '0.75rem', gap: '0.35rem', alignSelf: 'flex-start' }}
      >
        <Download size={11} />
        {downloading ? 'Downloading…' : 'Download .zip'}
      </button>
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{
          padding: '1rem', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', background: 'var(--bg-surface)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          {[80, 50, 65, 40].map((w, j) => (
            <div key={j} style={{
              height: j === 0 ? 14 : 10, width: `${w}%`,
              borderRadius: '6px',
              background: 'linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.06) 50%, var(--bg-card) 75%)',
              backgroundSize: '200% 100%',
              animation: `shimmer 1.5s linear ${i * 0.15 + j * 0.05}s infinite`,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}
