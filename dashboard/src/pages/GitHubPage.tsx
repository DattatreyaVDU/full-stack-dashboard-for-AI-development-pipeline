import { useState, useEffect } from 'react';
import {
  Github, GitCommit, ExternalLink, Upload, Code2,
  Loader2, Settings, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { github as githubApi } from '../api/client';
import { GitHubStatus, Commit, Build } from '../types';
import { useToast } from '../components/cards/ToastProvider';
import CodeViewer from '../components/panels/CodeViewer';

interface Props {
  latestBuild: Build | null;
  builds: Build[];
  onPipelineStep: (step: string, status: string) => void;
}

export default function GitHubPage({ latestBuild, builds, onPipelineStep }: Props) {
  const { toast } = useToast();

  // ── Connection state ──────────────────────────────────────────────────────
  const [status, setStatus]           = useState<GitHubStatus | null>(null);
  const [commits, setCommits]         = useState<Commit[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showConfig, setShowConfig]   = useState(false);

  // ── Config form ───────────────────────────────────────────────────────────
  const [cfgToken,  setCfgToken]  = useState('');
  const [cfgOwner,  setCfgOwner]  = useState('');
  const [cfgRepo,   setCfgRepo]   = useState('');
  const [cfgBranch, setCfgBranch] = useState('main');
  const [savingCfg, setSavingCfg] = useState(false);

  // ── Commit form ───────────────────────────────────────────────────────────
  const [selectedBuildId, setSelectedBuildId] = useState<string>('');
  const [filePath,   setFilePath]   = useState('');
  const [commitMsg,  setCommitMsg]  = useState('');
  const [committing, setCommitting] = useState(false);

  const selectedBuild = builds.find(b => b.id === selectedBuildId) ?? latestBuild;

  // ── Load status on mount ──────────────────────────────────────────────────
  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const [s, c] = await Promise.all([githubApi.status(), githubApi.commits()]);
      setStatus(s);
      setCommits(c);
      if (!s.connected) setShowConfig(true);
    } catch {
      setStatus({ connected: false, error: 'Server unreachable' });
      setShowConfig(true);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  // Auto-fill commit form when a build is selected
  useEffect(() => {
    if (selectedBuild) {
      const safe = selectedBuild.pageName.replace(/[^a-z0-9]/gi, '_');
      setFilePath(
        selectedBuild.filePath ||
        `generated/${selectedBuild.projectName.replace(/\s+/g, '_')}/${selectedBuild.pageId}_${safe}.md`
      );
      setCommitMsg(`feat: add ${selectedBuild.pageName} — ${selectedBuild.projectName} [n8n]`);
    }
  }, [selectedBuild?.id]);

  // ── Save config ───────────────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    if (!cfgToken || !cfgOwner || !cfgRepo) {
      toast('Token, owner and repo are required', 'error'); return;
    }
    setSavingCfg(true);
    try {
      await githubApi.config({ token: cfgToken, owner: cfgOwner, repo: cfgRepo, branch: cfgBranch });
      toast('GitHub config saved!', 'success', `${cfgOwner}/${cfgRepo}`);
      setShowConfig(false);
      await loadStatus();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSavingCfg(false);
    }
  };

  // ── Commit ────────────────────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!selectedBuild || !filePath) return;
    if (!selectedBuild.content) {
      toast('This build has no content to commit. Add content to your n8n HTTP Request.', 'error');
      return;
    }
    setCommitting(true);
    onPipelineStep('github', 'running');
    try {
      const result = await githubApi.commit({
        filePath,
        content: selectedBuild.content,
        message: commitMsg,
        projectName: selectedBuild.projectName,
      });
      onPipelineStep('github', 'done');
      toast(`Committed ${result.commit?.sha}`, 'success', commitMsg);
      const c = await githubApi.commits();
      setCommits(c);
    } catch (e: unknown) {
      onPipelineStep('github', 'error');
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (e instanceof Error ? e.message : 'Commit failed');
      toast(msg, 'error');
    } finally {
      setCommitting(false);
    }
  };

  const handleOpenVSCode = async () => {
    if (!filePath) return;
    try { await githubApi.openVSCode(filePath); toast('Opening VS Code…', 'info'); }
    catch { toast('VS Code open failed', 'error'); }
  };

  return (
    <div className="page-body">

      {/* ── Status card ── */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem', padding: '1rem 1.25rem',
          borderColor: loadingStatus ? 'var(--border)' :
                       status?.connected ? 'rgba(45,212,191,0.3)' : 'rgba(248,113,113,0.3)',
          display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        }}
      >
        {/* Icon + text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: loadingStatus ? 'var(--bg-surface)' :
                        status?.connected ? 'rgba(45,212,191,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1.5px solid ${loadingStatus ? 'var(--border)' : status?.connected ? 'rgba(45,212,191,0.3)' : 'rgba(248,113,113,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {loadingStatus
              ? <Loader2 size={17} style={{ animation: 'spin .65s linear infinite', color: 'var(--accent-blue)' }} />
              : status?.connected
                ? <CheckCircle size={17} style={{ color: 'var(--accent-teal)' }} />
                : <XCircle    size={17} style={{ color: 'var(--accent-red)'  }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {loadingStatus ? 'Checking connection…' :
               status?.connected ? status.repoName : 'GitHub not connected'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {loadingStatus ? 'Verifying GitHub token and repository access' :
               status?.connected ? (
                 <>branch <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)' }}>{status.defaultBranch}</code>
                 {' · '}{status.private ? '🔒 Private' : '🌍 Public'}
                 {status.lastPush && <> · last push {new Date(status.lastPush).toLocaleDateString()}</>}</>
               ) : (status?.error ?? 'Click Configure Repo to set up your GitHub token')}
            </div>
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={loadStatus} disabled={loadingStatus}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className={`btn btn-sm ${showConfig ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowConfig(v => !v)}
          >
            <Settings size={13} /> {showConfig ? 'Hide Config' : 'Configure Repo'}
          </button>
        </div>
      </div>

      {/* ── Config form ── */}
      {showConfig && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent-blue)', borderWidth: '1.5px' }}>
          <div className="card-header">
            <span className="card-title"><Github size={14} />GitHub Repository Setup</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Personal Access Token <span style={{ color: 'var(--accent-red)' }}>*</span></label>
              <input
                type="password"
                value={cfgToken}
                onChange={e => setCfgToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full"
              />
              <div className="form-hint">
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>
                  Create token →
                </a> needs <code>repo</code> scope
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Branch</label>
              <input
                value={cfgBranch}
                onChange={e => setCfgBranch(e.target.value)}
                placeholder="main"
                className="w-full"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">GitHub Username / Org <span style={{ color: 'var(--accent-red)' }}>*</span></label>
              <input
                value={cfgOwner}
                onChange={e => setCfgOwner(e.target.value)}
                placeholder="your-username"
                className="w-full"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Repository Name <span style={{ color: 'var(--accent-red)' }}>*</span></label>
              <input
                value={cfgRepo}
                onChange={e => setCfgRepo(e.target.value)}
                placeholder="my-repo"
                className="w-full"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleSaveConfig}
              disabled={savingCfg || !cfgToken || !cfgOwner || !cfgRepo}
            >
              {savingCfg ? <span className="spinner" /> : <CheckCircle size={14} />}
              {savingCfg ? 'Connecting…' : 'Connect Repository'}
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Config applies instantly — no server restart needed
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* ── Repo info card ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Github size={13} />Repository</span>
          </div>
          {loadingStatus ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Loader2 size={14} style={{ animation: 'spin .65s linear infinite' }} /> Loading…
            </div>
          ) : status?.connected ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.82rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Repo</span>
              <a href={`https://github.com/${status.repoName}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-blue)' }}>
                {status.repoName} <ExternalLink size={10} />
              </a>
              <span style={{ color: 'var(--text-muted)' }}>Branch</span>
              <code style={{ color: 'var(--accent-teal)', fontSize: '0.78rem' }}>{status.defaultBranch}</code>
              <span style={{ color: 'var(--text-muted)' }}>Visibility</span>
              <span style={{ color: 'var(--text-secondary)' }}>{status.private ? '🔒 Private' : '🌍 Public'}</span>
              <span style={{ color: 'var(--text-muted)' }}>Last push</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {status.lastPush ? new Date(status.lastPush).toLocaleString() : '—'}
              </span>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginBottom: '0.5rem' }}>
                {status?.error ?? 'Not configured'}
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowConfig(true)}>
                <Settings size={12} /> Set up repository
              </button>
            </div>
          )}
        </div>

        {/* ── Commit card ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Upload size={13} />Commit to GitHub</span>
          </div>

          {/* Build selector */}
          <div className="form-group">
            <label className="form-label">Select Build to Commit</label>
            <select
              value={selectedBuildId}
              onChange={e => setSelectedBuildId(e.target.value)}
              className="w-full"
            >
              <option value="">{latestBuild ? `Latest — ${latestBuild.projectName} / ${latestBuild.pageName}` : '— no builds yet —'}</option>
              {builds.map(b => (
                <option key={b.id} value={b.id}>
                  [{b.pageId}] {b.projectName} / {b.pageName}
                  {!b.content ? ' ⚠ no content' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">File Path in Repo</label>
              <input
                value={filePath}
                onChange={e => setFilePath(e.target.value)}
                placeholder="generated/01_home.md"
                className="w-full"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Commit Message</label>
              <input
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                placeholder="feat: add page"
                className="w-full"
              />
            </div>
          </div>

          {selectedBuild && !selectedBuild.content && (
            <div style={{
              marginTop: '0.75rem', padding: '0.6rem 0.875rem',
              background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.25)',
              borderRadius: 'var(--radius-sm)', fontSize: '0.775rem', color: 'var(--accent-orange)',
            }}>
              ⚠ This build has no content. Add <code>content</code> to your n8n HTTP Request body.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleCommit}
              disabled={committing || !status?.connected || !filePath || !selectedBuild?.content}
            >
              {committing ? <span className="spinner" /> : <Upload size={14} />}
              {committing ? 'Committing…' : 'Commit to GitHub'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleOpenVSCode}
              disabled={!filePath}
            >
              <Code2 size={13} /> Open VS Code
            </button>
            {!status?.connected && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConfig(true)}>
                <Settings size={12} /> Setup first
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent commits ── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <span className="card-title"><GitCommit size={13} />Recent Commits</span>
          <button className="btn btn-ghost btn-sm" onClick={loadStatus} disabled={loadingStatus}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        {commits.length > 0 ? (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {commits.map(c => (
              <li key={c.sha} style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr auto auto',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.875rem',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                fontSize: '0.82rem',
              }}>
                <code style={{ color: 'var(--accent-purple)', fontSize: '0.75rem' }}>{c.sha}</code>
                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{c.author}</span>
                <a href={c.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon">
                  <ExternalLink size={11} />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No commits yet — connect your repo and commit your first build above
          </div>
        )}
      </div>

      {/* ── Content preview ── */}
      {selectedBuild?.content && (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Code2 size={13} />Content to Commit</span>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {filePath}
            </span>
          </div>
          <CodeViewer
            content={selectedBuild.content}
            language="markdown"
            fileName={filePath}
            maxHeight="320px"
          />
        </div>
      )}
    </div>
  );
}
