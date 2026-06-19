import { useEffect, useRef, useState } from 'react';
import { Rocket, Terminal, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Pipeline, DeployLog } from '../types';

interface Props {
  pipeline: Pipeline;
  deployLogs: DeployLog[];
  onClearLogs: () => void;
}

export default function DeployPage({ pipeline, deployLogs, onClearLogs }: Props) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [deployLogs, autoScroll]);

  const { deploy: deployStatus } = pipeline;

  return (
    <div className="page-body">
      {/* Status banner */}
      <div
        className="card mb-4"
        style={{
          borderColor: deployStatus === 'done'    ? 'rgba(0,201,167,.35)'  :
                       deployStatus === 'error'   ? 'rgba(239,68,68,.35)'  :
                       deployStatus === 'running' ? 'rgba(59,130,246,.35)' : 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          {deployStatus === 'done' && <CheckCircle2 size={22} color="var(--accent-teal)" />}
          {deployStatus === 'error' && <XCircle size={22} color="var(--accent-red)" />}
          {deployStatus === 'running' && (
            <span className="spinner" style={{ color: 'var(--accent-blue)', width: '22px', height: '22px', borderWidth: '3px' }} />
          )}
          {deployStatus === 'idle' && <Rocket size={22} color="var(--text-muted)" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
              {deployStatus === 'done'    ? 'Deployment successful'   :
               deployStatus === 'error'   ? 'Deployment failed'       :
               deployStatus === 'running' ? 'Deploying to EasyWP...' : 'No deployment in progress'}
            </div>
            <div className="text-xs text-muted">
              {deployStatus === 'idle' ? 'Convert a WordPress theme and click Deploy to start.' :
               deployStatus === 'running' ? 'Uploading theme files via FTP...' :
               deployStatus === 'done' ? 'Theme uploaded. Activate it in WordPress Admin.' : 'Check the log below for details.'}
            </div>
          </div>
        </div>
      </div>

      {/* Full pipeline overview */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Rocket size={13} />Full Pipeline State</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '0.75rem',
          fontSize: '0.75rem',
        }}>
          {(Object.entries(pipeline) as [string, string][]).map(([key, val]) => (
            <div key={key} style={{ textAlign: 'center' }}>
              <div className={`badge badge-${val}`} style={{ display: 'block', marginBottom: '0.25rem', justifyContent: 'center' }}>
                {val}
              </div>
              <span className="text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem' }}>
                {key}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Deploy log */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Terminal size={13} />Deployment Log</span>
          <div className="flex gap-2">
            <button
              className={`btn btn-ghost btn-sm ${autoScroll ? 'active' : ''}`}
              style={autoScroll ? { background: 'rgba(59,130,246,.12)', color: 'var(--accent-blue)' } : {}}
              onClick={() => setAutoScroll(v => !v)}
              title="Toggle auto-scroll"
            >
              Auto-scroll {autoScroll ? 'ON' : 'OFF'}
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClearLogs} title="Clear log">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        <div className="deploy-log">
          {deployLogs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              Waiting for deploy to start...
            </div>
          ) : (
            deployLogs.map((log, i) => (
              <div key={i} className={`deploy-log-line ${log.type}`}>
                <span className="deploy-log-ts">
                  {new Date(log.ts).toLocaleTimeString()}
                </span>
                {log.msg}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* EasyWP instructions */}
      <div className="card" style={{ marginTop: '1.25rem', borderColor: 'rgba(139,92,246,.2)' }}>
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--accent-purple)' }}>EasyWP FTP Setup</span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p>Add these values to <code>server/.env</code>:</p>
          <div style={{
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.775rem',
            marginTop: '0.75rem',
            color: 'var(--accent-teal)',
            lineHeight: 1.8,
          }}>
            FTP_HOST=ftp.your-site.easywp.com<br />
            FTP_USER=your-cpanel-username<br />
            FTP_PASS=your-cpanel-password<br />
            FTP_REMOTE_PATH=/wp-content/themes
          </div>
          <p style={{ marginTop: '0.75rem' }}>
            Find FTP credentials in your <strong>EasyWP dashboard → FTP Accounts</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
