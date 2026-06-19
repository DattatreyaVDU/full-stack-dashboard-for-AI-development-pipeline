import { useState } from 'react';
import { Rocket, X, AlertTriangle } from 'lucide-react';
import { deploy as deployApi } from '../../api/client';

interface Props {
  onClose: () => void;
  zipBlob?: Blob;
  themeName: string;
}

export default function DeployModal({ onClose, zipBlob, themeName }: Props) {
  const [method, setMethod] = useState<'ftp' | 'actions'>('ftp');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleDeploy = async () => {
    setLoading(true);
    setError('');
    try {
      if (method === 'ftp' && zipBlob) {
        const base64 = await blobToBase64(zipBlob);
        await deployApi.ftp({ zipBase64: base64, themeName });
      } else {
        await deployApi.githubActions({ workflowId: 'deploy.yml' });
      }
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="modal-title">
              <Rocket size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
              Deploy to EasyWP
            </div>
            <div className="modal-subtitle">
              Theme: <strong>{themeName}</strong> — Choose your deployment method
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {!done ? (
          <>
            {/* Method picker */}
            <div className="flex gap-2 mb-4">
              {(['ftp', 'actions'] as const).map(m => (
                <button
                  key={m}
                  className={`btn ${method === m ? 'btn-blue' : 'btn-ghost'} w-full`}
                  onClick={() => setMethod(m)}
                  style={{ justifyContent: 'center' }}
                >
                  {m === 'ftp' ? '⬆️  FTP Upload' : '⚙️  GitHub Actions'}
                </button>
              ))}
            </div>

            <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              {method === 'ftp' ? (
                <div className="text-sm text-secondary">
                  <p>Uploads the WordPress theme ZIP directly to your EasyWP server via FTP.</p>
                  <p style={{ marginTop: '0.5rem' }} className="text-xs text-muted">
                    Uses <code>FTP_HOST</code>, <code>FTP_USER</code>, <code>FTP_PASS</code> from server <code>.env</code>
                  </p>
                  {!zipBlob && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', color: 'var(--accent-orange)' }}>
                      <AlertTriangle size={13} />
                      <span className="text-xs">No WordPress ZIP ready — convert first in the WordPress tab.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-secondary">
                  <p>Triggers a <code>workflow_dispatch</code> on your GitHub Actions <code>deploy.yml</code> workflow.</p>
                  <p style={{ marginTop: '0.5rem' }} className="text-xs text-muted">
                    Make sure <code>.github/workflows/deploy.yml</code> exists in your repo.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                {error}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={handleDeploy}
                disabled={loading || (method === 'ftp' && !zipBlob)}
              >
                {loading ? <span className="spinner" /> : <Rocket size={13} />}
                {loading ? 'Deploying...' : 'Deploy Now'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚀</div>
            <div style={{ fontWeight: 700, marginBottom: '0.375rem' }}>Deploy triggered!</div>
            <div className="text-sm text-secondary">Check the Deploy tab for live logs.</div>
            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
