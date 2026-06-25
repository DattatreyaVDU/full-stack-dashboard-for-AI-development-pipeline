import React, { useState } from 'react';
import { Settings, Server, Github, Globe, Webhook, Copy, Check, ChevronDown, ChevronRight, ExternalLink, Zap } from 'lucide-react';

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };
  return { copiedKey, copy };
}

interface EnvRowProps {
  name:    string;
  example: string;
  desc:    string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}

function EnvRow({ name, example, desc, copiedKey, onCopy }: EnvRowProps) {
  const isCopied = copiedKey === name;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '220px 1fr auto',
      alignItems: 'center', gap: '0.875rem',
      padding: '0.625rem 0.875rem',
      background: 'var(--bg-base)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
    }}>
      <code style={{ color: 'var(--accent-teal)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        {name}
      </code>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{desc}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
          e.g. <span style={{ color: 'var(--text-secondary)' }}>{example}</span>
        </div>
      </div>
      <button
        onClick={() => onCopy(name, `${name}=${example}`)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.25rem 0.5rem',
          border: `1px solid ${isCopied ? 'rgba(45,212,191,0.3)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          background: isCopied ? 'rgba(45,212,191,0.08)' : 'var(--bg-input)',
          color: isCopied ? 'var(--accent-teal)' : 'var(--text-muted)',
          fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          transition: 'all var(--transition)',
        }}
      >
        {isCopied ? <Check size={11} /> : <Copy size={11} />}
        {isCopied ? 'Copied!' : 'Copy key'}
      </button>
    </div>
  );
}

function CollapsibleSection({ title, icon, accent = 'var(--accent-teal)', children, defaultOpen = true }: {
  title: React.ReactNode; icon: React.ReactNode; accent?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '0', color: 'var(--text-primary)',
        }}
      >
        <span style={{ color: accent }}>{icon}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, flex: 1, textAlign: 'left', color: 'var(--text-primary)' }}>
          {title}
        </span>
        {open
          ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
      </button>
      {open && <div style={{ marginTop: '1rem' }}>{children}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const { copiedKey, copy } = useCopy();
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copySnippet = (key: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedSnippet(key);
      setTimeout(() => setCopiedSnippet(null), 2000);
    });
  };

  const serverEnvVars = [
    { name: 'PORT',             example: '3001',                         desc: 'API server port' },
    { name: 'FRONTEND_URL',     example: 'http://localhost:5173',        desc: 'CORS allowed origin' },
    { name: 'JWT_SECRET',       example: 'change-me-to-something-long',  desc: 'Token signing secret — keep it secret!' },
    { name: 'GITHUB_TOKEN',     example: 'ghp_xxxxxxxxxxxxxxxxxxxx',     desc: 'Personal access token (repo scope)' },
    { name: 'GITHUB_OWNER',     example: 'your-username',                desc: 'GitHub username or org' },
    { name: 'GITHUB_REPO',      example: 'your-repo',                    desc: 'Repository name' },
    { name: 'GITHUB_BRANCH',    example: 'main',                         desc: 'Target branch for commits' },
    { name: 'FTP_HOST',         example: 'ftp.your-domain.com',          desc: 'EasyWP FTP host' },
    { name: 'FTP_USER',         example: 'cpanel-username',              desc: 'FTP username' },
    { name: 'FTP_PASS',         example: '••••••••',                     desc: 'FTP password' },
    { name: 'FTP_REMOTE_PATH',  example: '/wp-content/themes',           desc: 'Remote theme upload directory' },
    { name: 'N8N_CHAT_URL',     example: 'http://nas-ip:5678/webhook/…', desc: 'n8n chat webhook (website pipeline)' },
    { name: 'N8N_MOBILE_CHAT_URL', example: 'http://nas-ip:5678/webhook/…', desc: 'n8n chat webhook (mobile pipeline)' },
    { name: 'SMTP_HOST',        example: 'smtp.gmail.com',               desc: 'Email server for verification emails' },
    { name: 'SMTP_USER',        example: 'you@gmail.com',                desc: 'SMTP login username' },
    { name: 'SMTP_PASS',        example: 'app-password',                 desc: 'SMTP password or app password' },
  ];

  const webhookBody = `{
  "project_name": "={{ $json.global_context.project_name }}",
  "page_id":      "={{ $json.id }}",
  "page_name":    "={{ $json.name }}",
  "content":      "={{ $json.output }}",
  "archivo_creado": "={{ $json.archivo_creado }}",
  "carpeta":      "={{ $json.carpeta }}",
  "global_context": "={{ $json.global_context }}"
}`;

  const backendCmd = `cd server\nnpm install\ncp .env.example .env\n# Edit .env, then:\nnpm run dev`;
  const frontendCmd = `cd dashboard\nnpm install\nnpm run dev\n# Opens at http://localhost:5173`;

  return (
    <div className="page-body">

      {/* ── Quick start ── */}
      <CollapsibleSection
        title="Quick Start"
        icon={<Zap size={15} />}
        accent="var(--accent-teal)"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { label: 'Backend (server)', cmd: backendCmd, key: 'backend', color: 'var(--accent-teal)' },
            { label: 'Frontend (dashboard)', cmd: frontendCmd, key: 'frontend', color: 'var(--accent-blue)' },
          ].map(({ label, cmd, key, color }) => (
            <div key={key}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                {label}
              </div>
              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem',
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                  color, lineHeight: 1.8, margin: 0, overflow: 'auto',
                }}>
                  {cmd}
                </pre>
                <button
                  onClick={() => copySnippet(key, cmd)}
                  style={{
                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.2rem 0.45rem', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
                    color: copiedSnippet === key ? 'var(--accent-teal)' : 'var(--text-muted)',
                    fontSize: '0.68rem', cursor: 'pointer',
                  }}
                >
                  {copiedSnippet === key ? <Check size={10} /> : <Copy size={10} />}
                  {copiedSnippet === key ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Server env vars ── */}
      <CollapsibleSection
        title="Environment Variables — server/.env"
        icon={<Server size={15} />}
        accent="var(--accent-blue)"
      >
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
          Copy <code>server/.env.example</code> to <code>server/.env</code> and fill in the values below.
          Restart the server after any changes.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {serverEnvVars.map(v => (
            <EnvRow key={v.name} {...v} copiedKey={copiedKey} onCopy={copy} />
          ))}
        </div>
      </CollapsibleSection>

      {/* ── n8n Webhook Setup ── */}
      <CollapsibleSection
        title="n8n Webhook Setup"
        icon={<Webhook size={15} />}
        accent="var(--accent-purple)"
      >
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
          Add an <strong>HTTP Request</strong> node after your <em>File Creation Website</em> node in n8n:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { label: 'Method', value: 'POST', color: 'var(--accent-teal)' },
            { label: 'URL',    value: 'https://your-server.onrender.com/api/webhook/n8n', color: 'var(--accent-blue)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </span>
              <code style={{ fontSize: '0.78rem', color, fontFamily: 'var(--font-mono)', background: 'var(--bg-base)', padding: '0.35rem 0.625rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {value}
              </code>
              <button
                onClick={() => copySnippet(`webhook-${label}`, value)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: copiedSnippet === `webhook-${label}` ? 'var(--accent-teal)' : 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}
              >
                {copiedSnippet === `webhook-${label}` ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          ))}

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
              Body (JSON)
            </div>
            <div style={{ position: 'relative' }}>
              <pre style={{
                background: 'var(--bg-base)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem',
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0,
              }}>
                {webhookBody}
              </pre>
              <button
                onClick={() => copySnippet('webhook-body', webhookBody)}
                style={{
                  position: 'absolute', top: '0.5rem', right: '0.5rem',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.2rem 0.45rem', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
                  color: copiedSnippet === 'webhook-body' ? 'var(--accent-teal)' : 'var(--text-muted)',
                  fontSize: '0.68rem', cursor: 'pointer',
                }}
              >
                {copiedSnippet === 'webhook-body' ? <Check size={10} /> : <Copy size={10} />}
                {copiedSnippet === 'webhook-body' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── GitHub + EasyWP side by side ── */}
      <div className="grid-2">
        <CollapsibleSection
          title="GitHub Token Permissions"
          icon={<Github size={15} />}
          accent="var(--text-secondary)"
        >
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
            Create a <strong>Fine-grained personal access token</strong> at:
          </p>
          <a
            href="https://github.com/settings/tokens/new"
            target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.78rem', color: 'var(--accent-blue)',
              padding: '0.35rem 0.75rem',
              border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(96,165,250,0.06)',
              marginBottom: '0.875rem',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={11} /> github.com/settings/tokens
          </a>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2, margin: 0 }}>
            <li><strong>Contents</strong> — Read &amp; Write</li>
            <li><strong>Metadata</strong> — Read</li>
            <li><strong>Actions</strong> — Write (for GitHub Actions deploy)</li>
          </ul>
        </CollapsibleSection>

        <CollapsibleSection
          title="EasyWP FTP Access"
          icon={<Globe size={15} />}
          accent="var(--accent-blue)"
        >
          <ol style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2.2, margin: 0 }}>
            <li>Log into <strong>my.easywp.com</strong></li>
            <li>Open your site → <strong>FTP Accounts</strong></li>
            <li>Create or copy existing FTP credentials</li>
            <li>Paste into <code>server/.env</code> as<br />
              <code style={{ color: 'var(--accent-teal)', fontSize: '0.73rem' }}>FTP_HOST</code>,{' '}
              <code style={{ color: 'var(--accent-teal)', fontSize: '0.73rem' }}>FTP_USER</code>,{' '}
              <code style={{ color: 'var(--accent-teal)', fontSize: '0.73rem' }}>FTP_PASS</code>
            </li>
          </ol>
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 'var(--radius-sm)', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            Default port: 21 · <code>FTP_REMOTE_PATH</code> = <code>/wp-content/themes</code>
          </div>
        </CollapsibleSection>
      </div>

    </div>
  );
}
