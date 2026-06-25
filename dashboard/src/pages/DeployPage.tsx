import { useEffect, useRef, useState } from 'react';
import { Rocket, Terminal, RefreshCw, CheckCircle2, XCircle, Zap, GitBranch, Globe, Package, Code2, UploadCloud } from 'lucide-react';
import { Pipeline, DeployLog } from '../types';

interface Props {
  pipeline: Pipeline;
  deployLogs: DeployLog[];
  onClearLogs: () => void;
}

const STEP_META: Record<string, { label: string; icon: React.ReactNode }> = {
  webhook:   { label: 'Webhook',   icon: <Zap       size={12} /> },
  github:    { label: 'GitHub',    icon: <GitBranch size={12} /> },
  wordpress: { label: 'WordPress', icon: <Globe     size={12} /> },
  convert:   { label: 'Convert',   icon: <Package   size={12} /> },
  build:     { label: 'Build',     icon: <Code2     size={12} /> },
  deploy:    { label: 'Deploy',    icon: <UploadCloud size={12} /> },
};

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  done:    { bg: 'rgba(45,212,191,0.08)',  border: 'rgba(45,212,191,0.25)',  color: 'var(--accent-teal)',   dot: 'var(--accent-teal)'   },
  running: { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)',  color: 'var(--accent-blue)',   dot: 'var(--accent-blue)'   },
  error:   { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', color: 'var(--accent-red)',    dot: 'var(--accent-red)'    },
  idle:    { bg: 'transparent',            border: 'var(--border)',           color: 'var(--text-muted)',    dot: 'var(--border)'        },
};

const LOG_COLOR: Record<string, string> = {
  success: '#4ade80',
  error:   '#f87171',
  info:    '#93c5fd',
  warn:    '#fbbf24',
};

export default function DeployPage({ pipeline, deployLogs, onClearLogs }: Props) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [deployLogs, autoScroll]);

  const { deploy: deployStatus } = pipeline;

  const deployBorderColor =
    deployStatus === 'done'    ? 'rgba(45,212,191,0.35)'  :
    deployStatus === 'error'   ? 'rgba(248,113,113,0.35)' :
    deployStatus === 'running' ? 'rgba(96,165,250,0.35)'  : 'var(--border)';

  return (
    <div className="page-body">

      {/* ── Status banner ── */}
      <div className="card" style={{ marginBottom: '1.25rem', borderColor: deployBorderColor }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {deployStatus === 'done'    && <CheckCircle2 size={22} color="var(--accent-teal)" />}
          {deployStatus === 'error'   && <XCircle      size={22} color="var(--accent-red)"  />}
          {deployStatus === 'running' && <span className="spinner" style={{ color: 'var(--accent-blue)', width: 22, height: 22, borderWidth: 3 }} />}
          {deployStatus === 'idle'    && <Rocket       size={22} color="var(--text-muted)"  />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              {deployStatus === 'done'    ? 'Deployment successful'    :
               deployStatus === 'error'   ? 'Deployment failed'        :
               deployStatus === 'running' ? 'Deploying to EasyWP…'    : 'No deployment in progress'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {deployStatus === 'idle'    ? 'Convert a WordPress theme and click Deploy to start.' :
               deployStatus === 'running' ? 'Uploading theme files via FTP — do not close this tab.' :
               deployStatus === 'done'    ? 'Theme uploaded. Go to WordPress Admin → Appearance → Themes to activate.' :
               'Check the deploy log below for the full error trace.'}
            </div>
          </div>
          {deployStatus === 'done' && (
            <span style={{
              padding: '0.25rem 0.75rem', borderRadius: '999px',
              background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)',
              fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-teal)',
            }}>
              Complete
            </span>
          )}
        </div>
      </div>

      {/* ── Pipeline step grid ── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <span className="card-title"><Rocket size={13} />Pipeline State</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.625rem' }}>
          {(Object.entries(pipeline) as [string, string][]).map(([key, val]) => {
            const meta = STEP_META[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), icon: null };
            const s    = STATUS_STYLE[val] ?? STATUS_STYLE.idle;
            return (
              <div key={key} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem',
                padding: '0.75rem 0.5rem',
                background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: s.color }}>
                  {meta.icon}
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: s.dot,
                    boxShadow: val === 'running' ? `0 0 6px ${s.dot}` : 'none',
                  }} />
                  <span style={{ fontSize: '0.7rem', color: s.color, fontWeight: 600 }}>{val}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Deploy log (terminal) ── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <span className="card-title"><Terminal size={13} />Deploy Log</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {deployLogs.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {deployLogs.length} lines
              </span>
            )}
            <button
              className="btn btn-ghost btn-sm"
              style={autoScroll ? { background: 'rgba(96,165,250,0.1)', color: 'var(--accent-blue)' } : {}}
              onClick={() => setAutoScroll(v => !v)}
            >
              Auto-scroll {autoScroll ? 'ON' : 'OFF'}
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClearLogs} title="Clear log">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Terminal chrome */}
        <div style={{
          background: '#0c0f1a',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          {/* Traffic lights bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {['#ff5f57','#febc2e','#28c840'].map(c => (
              <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
            ))}
            <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
              deploy@easywp ~ ftp
            </span>
          </div>

          {/* Log lines */}
          <div style={{ maxHeight: 380, overflow: 'auto', padding: '0.75rem 1rem' }}>
            {deployLogs.length === 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: 'rgba(255,255,255,0.2)', fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)', padding: '1.5rem 0',
              }}>
                <span style={{ color: '#4ade80' }}>$</span> waiting for deploy to start…
                <span style={{ animation: 'cursor-blink 1s step-end infinite', borderRight: '2px solid rgba(255,255,255,0.3)', marginLeft: 1 }} />
              </div>
            ) : (
              deployLogs.map((log, i) => (
                <div
                  key={`${log.ts}-${i}`}
                  style={{
                    display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                    fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: 1.65,
                    padding: '0.1rem 0',
                    borderBottom: i < deployLogs.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', minWidth: 28, textAlign: 'right', flexShrink: 0, paddingTop: '0.15rem' }}>
                    {i + 1}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0, paddingTop: '0.15rem', fontSize: '0.68rem' }}>
                    {new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span style={{ color: LOG_COLOR[log.type] ?? '#e2e8f0', flex: 1, wordBreak: 'break-word' }}>
                    {log.type === 'error' && <span style={{ color: '#f87171', marginRight: '0.4rem' }}>✗</span>}
                    {log.type === 'success' && <span style={{ color: '#4ade80', marginRight: '0.4rem' }}>✓</span>}
                    {log.msg}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* ── EasyWP FTP Setup ── */}
      <div className="card" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--accent-purple)' }}>
            <Globe size={13} /> EasyWP FTP Setup
          </span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.875rem', lineHeight: 1.7 }}>
          Add these values to <code>server/.env</code> — the deploy button uses them to upload via FTP:
        </p>
        <div style={{
          background: '#0c0f1a', borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '0.875rem 1rem',
          fontFamily: 'var(--font-mono)', fontSize: '0.775rem',
          color: 'var(--accent-teal)', lineHeight: 2,
        }}>
          FTP_HOST=ftp.your-site.easywp.com<br />
          FTP_USER=your-cpanel-username<br />
          FTP_PASS=your-cpanel-password<br />
          FTP_REMOTE_PATH=/wp-content/themes
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.6 }}>
          Find credentials in <strong>EasyWP dashboard → your site → FTP Accounts</strong>.
          The theme will be uploaded to <code>/wp-content/themes/</code> and can then be activated from WordPress Admin.
        </p>
      </div>

      <style>{`
        @keyframes cursor-blink {
          50% { border-color: transparent; }
        }
      `}</style>
    </div>
  );
}
