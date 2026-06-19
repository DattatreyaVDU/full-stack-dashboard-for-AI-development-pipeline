import React from 'react';
import { Settings, Server, Github, Globe, Webhook } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="page-body">
      <div className="grid-2">
        {/* Server config */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Server size={13} />Server Configuration</span>
          </div>
          <p className="text-sm text-secondary" style={{ marginBottom: '1rem' }}>
            All settings are managed via environment variables in <code>server/.env</code>.
            Restart the server after changes.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 0.875rem', fontSize: '0.8rem' }}>
            {[
              ['PORT',           '3001 (default)',           'API server port'],
              ['FRONTEND_URL',   'http://localhost:5173',    'CORS allowed origin'],
              ['GITHUB_TOKEN',   'ghp_...',                  'Personal access token'],
              ['GITHUB_OWNER',   'your-username',            'GitHub username or org'],
              ['GITHUB_REPO',    'your-repo',                'Repository name'],
              ['GITHUB_BRANCH',  'main',                     'Target branch'],
              ['FTP_HOST',       'ftp.your-domain.com',      'EasyWP FTP host'],
              ['FTP_USER',       '...',                      'FTP username'],
              ['FTP_PASS',       '...',                      'FTP password'],
              ['FTP_REMOTE_PATH','/wp-content/themes',       'Remote theme directory'],
            ].map(([key, example, desc]) => (
              <React.Fragment key={key}>
                <code style={{ color: 'var(--accent-teal)', fontSize: '0.75rem', alignSelf: 'start', marginTop: '2px' }}>
                  {key}
                </code>
                <div>
                  <div className="text-secondary">{desc}</div>
                  <div className="text-xs text-muted font-mono">{example}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* n8n setup */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Webhook size={13} />n8n Webhook Setup</span>
          </div>
          <p className="text-sm text-secondary" style={{ marginBottom: '1rem' }}>
            Add an <strong>HTTP Request</strong> node after your <em>File Creation Website</em> node
            in n8n to send builds to this dashboard.
          </p>

          <div className="form-group">
            <label className="form-label">Method</label>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', fontSize: '0.8rem' }}>POST</div>
          </div>
          <div className="form-group">
            <label className="form-label">URL</label>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontSize: '0.8rem' }}>
              http://YOUR_NAS_IP:3001/api/webhook/n8n
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Body (JSON) — map from n8n node outputs</label>
            <pre style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
              overflow: 'auto',
            }}>
{`{
  "project_name": "={{ $json.global_context.project_name }}",
  "page_id":      "={{ $json.id }}",
  "page_name":    "={{ $json.name }}",
  "content":      "={{ $json.output }}",
  "archivo_creado": "={{ $json.archivo_creado }}",
  "carpeta":      "={{ $json.carpeta }}",
  "global_context": "={{ $json.global_context }}"
}`}
            </pre>
          </div>
        </div>

        {/* GitHub */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Github size={13} />GitHub Token Permissions</span>
          </div>
          <p className="text-sm text-secondary" style={{ marginBottom: '0.75rem' }}>
            Create a <strong>Fine-grained personal access token</strong> at{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
              github.com/settings/tokens
            </a> with:
          </p>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
            <li><strong>Contents</strong> — Read & Write</li>
            <li><strong>Metadata</strong> — Read</li>
            <li><strong>Actions</strong> — Write (if using GitHub Actions deploy)</li>
          </ul>
        </div>

        {/* EasyWP */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Globe size={13} />EasyWP FTP Access</span>
          </div>
          <ol style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
            <li>Log into <strong>my.easywp.com</strong></li>
            <li>Open your site → <strong>FTP Accounts</strong></li>
            <li>Create or copy existing FTP credentials</li>
            <li>Paste into <code>server/.env</code> as <code>FTP_HOST</code>, <code>FTP_USER</code>, <code>FTP_PASS</code></li>
          </ol>
          <div className="text-xs text-muted" style={{ marginTop: '0.75rem' }}>
            The default port is 21. <code>FTP_REMOTE_PATH</code> should be <code>/wp-content/themes</code>.
          </div>
        </div>
      </div>

      {/* Quick start */}
      <div className="card" style={{ marginTop: '1.25rem', borderColor: 'rgba(0,201,167,.2)' }}>
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--accent-teal)' }}>
            <Settings size={13} />Quick Start Commands
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
          <div>
            <div className="form-label">Install & run the backend</div>
            <pre style={{
              background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-teal)', lineHeight: 1.8,
            }}>
{`cd server
npm install
cp .env.example .env
# Edit .env, then:
npm run dev`}
            </pre>
          </div>
          <div>
            <div className="form-label">Install & run the frontend</div>
            <pre style={{
              background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-blue)', lineHeight: 1.8,
            }}>
{`cd dashboard
npm install
npm run dev
# Opens at http://localhost:5173`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
