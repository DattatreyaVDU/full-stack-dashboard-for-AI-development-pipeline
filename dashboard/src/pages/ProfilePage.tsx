import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Lock, Github, Copy, Check, Eye, EyeOff,
  ShieldCheck, ExternalLink, AlertTriangle, CheckCircle2, Crown,
  Trash2, RefreshCw, Send, UserCheck, Users, Webhook,
  KeyRound, Pencil, X, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useToast } from '../components/cards/ToastProvider';

const API = (import.meta.env.VITE_API_URL ?? '') + '/api';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30)  return `${d} days ago`;
  const m = Math.floor(d / 30);
  if (m < 12)  return `${m} month${m > 1 ? 's' : ''} ago`;
  return `${Math.floor(m / 12)}y ago`;
}

/* ── Section wrapper ─────────────────────────────────────────── */
function Section({
  title, desc, icon, accent = 'var(--accent-teal)', children, noPad,
}: {
  title: string; desc?: string; icon?: React.ReactNode;
  accent?: string; children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        {icon && (
          <div style={{
            width: 34, height: 34, borderRadius: '9px', flexShrink: 0,
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent,
          }}>
            {icon}
          </div>
        )}
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {title}
          </div>
          {desc && (
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.5 }}>
              {desc}
            </div>
          )}
        </div>
      </div>
      <div style={noPad ? {} : { padding: '1.375rem 1.5rem' }}>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem',
      borderRadius: '999px',
      background: ok ? 'rgba(45,212,191,0.1)' : 'rgba(100,116,139,0.1)',
      color:      ok ? 'var(--accent-teal)'    : 'var(--text-muted)',
      border: `1px solid ${ok ? 'rgba(45,212,191,0.25)' : 'var(--border)'}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function ProfilePage() {
  const { user, refreshUser, getToken, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [copied, setCopied] = useState(false);

  const headers = (extra?: object) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  });

  const copyWebhook = () => {
    if (!user) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/api/webhook/n8n?userToken=${user.webhookToken}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <div className="page-body" style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* ── Hero header card ─────────────────────────────────── */}
      <div className="card" style={{
        marginBottom: '1rem', overflow: 'hidden',
        background: 'var(--bg-card)',
      }}>
        {/* Colour band */}
        <div style={{
          height: 72,
          background: isAdmin
            ? 'linear-gradient(120deg, rgba(234,88,12,0.25) 0%, rgba(147,51,234,0.2) 50%, rgba(45,212,191,0.1) 100%)'
            : 'linear-gradient(120deg, rgba(45,212,191,0.15) 0%, rgba(96,165,250,0.15) 60%, rgba(167,139,250,0.1) 100%)',
          position: 'relative',
        }}>
          {/* subtle grid pattern */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }} />
        </div>

        {/* Content row */}
        <div style={{ padding: '0 1.75rem 1.5rem', position: 'relative' }}>
          {/* Avatar overlapping the band */}
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: isAdmin
              ? 'linear-gradient(135deg, #ea580c, #9333ea)'
              : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35), 0 0 0 3px var(--bg-card)',
            marginTop: -34,
            border: '3px solid var(--bg-card)',
          }}>
            {initials(user.name)}
          </div>

          {/* Name + meta */}
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {user.name}
                </h1>
                {isAdmin ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.625rem',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, rgba(234,88,12,0.2), rgba(147,51,234,0.2))',
                    color: 'var(--accent-orange)', border: '1px solid rgba(234,88,12,0.3)',
                  }}>
                    <Crown size={10} /> ADMIN
                  </span>
                ) : (
                  <StatusPill ok label="USER" />
                )}
                <StatusPill ok={user.emailVerified} label={user.emailVerified ? 'Verified' : 'Unverified'} />
                {user.github && <StatusPill ok label="GitHub" />}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                {user.email}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {isAdmin && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')} style={{ gap: '0.375rem' }}>
                  <ShieldCheck size={13} /> Admin Panel
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: '1.5rem', marginTop: '1.25rem',
            padding: '0.875rem 1rem',
            background: 'var(--bg-base)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}>
            {[
              { label: 'Member since', value: new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
              { label: 'Joined',       value: timeAgo(user.createdAt) },
              { label: 'Email',        value: user.emailVerified ? 'Verified' : 'Pending verification' },
              { label: 'GitHub',       value: user.github ? `@${user.github.username}` : 'Not connected' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Personal Info ── */}
      <PersonalInfoSection
        user={user}
        headers={headers()}
        onSuccess={async () => { await refreshUser(); toast('Profile updated', 'success'); }}
        onError={(msg: string) => toast(msg, 'error')}
      />

      {/* ── Security ── */}
      <PasswordSection
        headers={headers()}
        onSuccess={() => toast('Password changed', 'success')}
        onError={(msg: string) => toast(msg, 'error')}
      />

      {/* ── GitHub Integration ── */}
      <GitHubSection
        user={user}
        headers={headers()}
        getToken={getToken}
        onSuccess={async (msg: string) => { await refreshUser(); toast(msg, 'success'); }}
        onError={(msg: string) => toast(msg, 'error')}
      />

      {/* ── Webhook URL ── */}
      <Section
        title="Your Webhook URL"
        desc="Paste this URL into both HTTP Request nodes in your n8n workflow to auto-push builds to this dashboard."
        icon={<Webhook size={15} />}
        accent="var(--accent-blue)"
      >
        <div style={{
          background: 'var(--bg-base)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.5rem 0.875rem',
            background: 'rgba(96,165,250,0.05)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.65rem', fontWeight: 700,
            color: 'var(--accent-blue)', letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}>
            Webhook Endpoint
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem' }}>
            <code style={{
              flex: 1, fontSize: '0.75rem', color: 'var(--accent-blue)',
              fontFamily: 'var(--font-mono)', wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {window.location.origin}/api/webhook/n8n?userToken={user.webhookToken}
            </code>
            <button
              onClick={copyWebhook}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.45rem 0.875rem', flexShrink: 0,
                border: `1px solid ${copied ? 'rgba(45,212,191,0.35)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                background: copied ? 'rgba(45,212,191,0.08)' : 'var(--bg-surface)',
                color: copied ? 'var(--accent-teal)' : 'var(--text-secondary)',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.75rem 0 0', lineHeight: 1.6 }}>
          Keep this URL private. If it's ever exposed, regenerate it from Settings.
        </p>
      </Section>

      {/* ── Email Verification ── */}
      <EmailVerificationSection
        user={user}
        headers={headers()}
        onSuccess={async () => { await refreshUser(); toast('Verification email sent — check your inbox', 'success'); }}
        onError={(msg: string) => toast(msg, 'error')}
      />

      {/* ── Admin: User Management ── */}
      {isAdmin && <AdminUserManagement headers={headers()} />}

      {/* ── Danger Zone ── */}
      <DeleteAccountSection
        headers={headers()}
        onDeleted={() => { logout(); navigate('/login'); }}
        onError={(msg: string) => toast(msg, 'error')}
      />

    </div>
  );
}

/* ── Personal Info ─────────────────────────────────────────────── */
function PersonalInfoSection({ user, headers, onSuccess, onError }: any) {
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(user.name);
  const [email,   setEmail]   = useState(user.email);
  const [saving,  setSaving]  = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { onError('Name cannot be empty'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/auth/profile`, {
        method: 'PATCH', headers, body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditing(false);
      onSuccess();
    } catch (e: any) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Section
      title="Personal Information"
      desc="Your display name and email address used across the dashboard."
      icon={<User size={15} />}
      accent="var(--accent-teal)"
    >
      {editing ? (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <InputField label="Full Name" icon={<User size={13} />}>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name" />
            </InputField>
            <InputField label="Email Address" icon={<Mail size={13} />}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
            </InputField>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Saving…</> : <><Check size={13} /> Save Changes</>}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setName(user.name); setEmail(user.email); }}>
              <X size={13} /> Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { label: 'Full Name',     value: user.name,  icon: <User size={13} /> },
              { label: 'Email Address', value: user.email, icon: <Mail size={13} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{
                padding: '0.75rem 1rem',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                </div>
                <div style={{ fontSize: '0.8375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} style={{ gap: '0.375rem' }}>
            <Pencil size={12} /> Edit Profile
          </button>
        </div>
      )}
    </Section>
  );
}

/* ── Password ─────────────────────────────────────────────────── */
function PasswordSection({ headers, onSuccess, onError }: any) {
  const [open,        setOpen]        = useState(false);
  const [current,     setCurrent]     = useState('');
  const [next,        setNext]        = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext,    setShowNext]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  const strength = !next ? 0 : next.length < 8 ? 1 : /[A-Z]/.test(next) && /[0-9]/.test(next) ? 3 : 2;
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'];
  const strengthColor = ['', 'var(--accent-red)', 'var(--accent-orange)', 'var(--accent-teal)'];

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { onError('New passwords do not match'); return; }
    if (next.length < 6)  { onError('New password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/auth/password`, {
        method: 'PATCH', headers, body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false); setCurrent(''); setNext(''); setConfirm('');
      onSuccess();
    } catch (e: any) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Section
      title="Security"
      desc="Change your password. Use a strong, unique password you don't use anywhere else."
      icon={<KeyRound size={15} />}
      accent="var(--accent-purple)"
    >
      {open ? (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <InputField label="Current Password" icon={<Lock size={13} />}
            extra={<ToggleVisBtn show={showCurrent} toggle={() => setShowCurrent(p => !p)} />}>
            <input type={showCurrent ? 'text' : 'password'} value={current}
              onChange={e => setCurrent(e.target.value)} required placeholder="Your current password"
              style={{ paddingRight: '2.5rem' }} />
          </InputField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <InputField label="New Password" icon={<Lock size={13} />}
                extra={<ToggleVisBtn show={showNext} toggle={() => setShowNext(p => !p)} />}>
                <input type={showNext ? 'text' : 'password'} value={next}
                  onChange={e => setNext(e.target.value)} required placeholder="Min 6 characters"
                  style={{ paddingRight: '2.5rem' }} />
              </InputField>
              {next && (
                <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{
                        height: 3, flex: 1, borderRadius: '999px',
                        background: i <= strength ? strengthColor[strength] : 'var(--border)',
                        transition: 'background var(--transition)',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: strengthColor[strength], fontWeight: 700 }}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}
            </div>
            <InputField label="Confirm New Password" icon={<Lock size={13} />}>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required placeholder="Repeat new password"
                style={{ borderColor: confirm && confirm !== next ? 'rgba(248,113,113,0.5)' : '' }} />
            </InputField>
          </div>

          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Changing…</> : 'Change Password'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setCurrent(''); setNext(''); setConfirm(''); }}>
              <X size={13} /> Cancel
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-base)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', flex: 1,
          }}>
            <Lock size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                ••••••••••••
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} style={{ gap: '0.375rem', flexShrink: 0 }}>
            <Pencil size={12} /> Change Password
          </button>
        </div>
      )}
    </Section>
  );
}

/* ── GitHub Integration ─────────────────────────────────────── */
function GitHubSection({ user, headers, getToken, onSuccess, onError }: any) {
  const github = user.github;
  const [repos,          setRepos]          = useState<any[]>([]);
  const [loadingRepos,   setLoadingRepos]   = useState(false);
  const [selectedRepo,   setSelectedRepo]   = useState(github?.selectedRepo ?? '');
  const [savingRepo,     setSavingRepo]     = useState(false);
  const [showRepoPicker, setShowRepoPicker] = useState(false);

  const connectGitHub = () => {
    window.location.href = `${API}/auth/github/connect?_token=${encodeURIComponent(getToken())}`;
  };

  const disconnectGitHub = async () => {
    if (!confirm('Disconnect GitHub? Auto-push will stop until you reconnect.')) return;
    const res = await fetch(`${API}/auth/github/disconnect`, { method: 'DELETE', headers });
    if (res.ok) onSuccess('GitHub disconnected');
    else onError('Failed to disconnect');
  };

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const res  = await fetch(`${API}/auth/github/repos`, { headers });
      const data = await res.json();
      setRepos(data.repos ?? []);
      setShowRepoPicker(true);
    } catch { onError('Could not load repositories'); }
    finally { setLoadingRepos(false); }
  };

  const saveRepo = async () => {
    if (!selectedRepo) { onError('Please select a repository'); return; }
    setSavingRepo(true);
    try {
      const res  = await fetch(`${API}/auth/github/select`, {
        method: 'POST', headers, body: JSON.stringify({ repoFullName: selectedRepo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowRepoPicker(false);
      onSuccess(`Repository set to ${selectedRepo}`);
    } catch (e: any) { onError(e.message); }
    finally { setSavingRepo(false); }
  };

  return (
    <Section
      title="GitHub Integration"
      desc="Connect your GitHub account so generated files are automatically committed to your chosen repository."
      icon={<Github size={15} />}
      accent="var(--text-secondary)"
    >
      {!github ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.875rem',
          padding: '1rem',
          background: 'var(--bg-base)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Github size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.8375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GitHub not connected</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Connect to enable automatic file commits on every build</div>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={connectGitHub} style={{ gap: '0.4rem' }}>
            <Github size={13} /> Connect GitHub
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {/* Connected user row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '0.625rem',
            padding: '0.875rem 1rem',
            background: 'rgba(45,212,191,0.04)', border: '1px solid rgba(45,212,191,0.2)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Github size={18} style={{ color: 'var(--accent-teal)' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.8375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  @{github.username}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                  <CheckCircle2 size={11} style={{ color: 'var(--accent-teal)' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', fontWeight: 600 }}>Connected</span>
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={disconnectGitHub} style={{ color: 'var(--accent-red)', fontSize: '0.78rem', gap: '0.35rem' }}>
              <X size={12} /> Disconnect
            </button>
          </div>

          {/* Repo selector */}
          <div style={{
            background: 'var(--bg-base)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.75rem 1rem', borderBottom: showRepoPicker ? '1px solid var(--border)' : 'none',
              flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>
                  Active Repository
                </div>
                {github.selectedRepo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                      {github.selectedRepo}
                    </code>
                    <a href={`https://github.com/${github.selectedRepo}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={12} /> No repository selected
                  </span>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadRepos} disabled={loadingRepos} style={{ gap: '0.35rem' }}>
                {loadingRepos ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <ChevronRight size={13} />}
                {github.selectedRepo ? 'Change' : 'Select Repo'}
              </button>
            </div>

            {showRepoPicker && (
              <div style={{ padding: '0.875rem 1rem' }}>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.625rem', lineHeight: 1.5 }}>
                  Generated files will be committed to <code>generated-files/</code> inside the selected repo.
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)} style={{ flex: 1 }}>
                    <option value="">— Select a repository —</option>
                    {repos.map(r => (
                      <option key={r.id} value={r.fullName}>{r.fullName}{r.private ? ' 🔒' : ''}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={saveRepo} disabled={savingRepo || !selectedRepo}>
                    {savingRepo ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowRepoPicker(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── Email Verification ────────────────────────────────────────── */
function EmailVerificationSection({ user, headers, onSuccess, onError }: any) {
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/resend-verification`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess();
    } catch (e: any) { onError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Section
      title="Email Verification"
      desc="Verified accounts get full access to all dashboard features."
      icon={<Mail size={15} />}
      accent={user.emailVerified ? 'var(--accent-teal)' : 'var(--accent-orange)'}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.875rem',
        padding: '0.875rem 1rem',
        background: user.emailVerified ? 'rgba(45,212,191,0.05)' : 'rgba(251,146,60,0.05)',
        border: `1px solid ${user.emailVerified ? 'rgba(45,212,191,0.2)' : 'rgba(251,146,60,0.2)'}`,
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user.emailVerified
            ? <CheckCircle2 size={16} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
            : <AlertTriangle size={16} style={{ color: 'var(--accent-orange)', flexShrink: 0 }} />
          }
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user.emailVerified ? 'Email verified' : 'Email not yet verified'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              {user.email}
            </div>
          </div>
        </div>
        {!user.emailVerified && (
          <button className="btn btn-ghost btn-sm" onClick={resend} disabled={loading} style={{ gap: '0.4rem', color: 'var(--accent-orange)' }}>
            {loading ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <RefreshCw size={13} />}
            {loading ? 'Sending…' : 'Resend Email'}
          </button>
        )}
      </div>
    </Section>
  );
}

/* ── Admin: User Management ───────────────────────────────────── */
const ADMIN_API = (import.meta.env.VITE_API_URL ?? '') + '/api/admin';

interface ManagedUser {
  id:            string;
  name:          string;
  email:         string;
  role:          'admin' | 'user';
  emailVerified: boolean;
  createdAt:     string;
}

function AdminUserManagement({ headers }: { headers: Record<string, string> }) {
  const [users,       setUsers]       = useState<ManagedUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [sendingId,   setSendingId]   = useState<string | null>(null);
  const [feedbackId,  setFeedbackId]  = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackOk,  setFeedbackOk]  = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ADMIN_API}/users`, { headers });
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const showFeedback = (id: string, msg: string, ok = true) => {
    setFeedbackId(id); setFeedbackMsg(msg); setFeedbackOk(ok);
    setTimeout(() => setFeedbackId(null), 4000);
  };

  const sendVerification = async (u: ManagedUser) => {
    setSendingId(u.id);
    try {
      const res  = await fetch(`${ADMIN_API}/users/${u.id}/send-verification`, { method: 'POST', headers });
      const data = await res.json();
      showFeedback(u.id, data.message ?? (res.ok ? 'Email sent!' : data.error), res.ok);
    } catch { showFeedback(u.id, 'Network error', false); }
    finally   { setSendingId(null); }
  };

  const markVerified = async (u: ManagedUser) => {
    try {
      const res  = await fetch(`${ADMIN_API}/users/${u.id}/verify`, { method: 'PATCH', headers });
      const data = await res.json();
      if (data.user) {
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, emailVerified: true } : x));
        showFeedback(u.id, 'Marked as verified', true);
      }
    } catch { showFeedback(u.id, 'Failed — try again', false); }
  };

  const unverified = users.filter(u => !u.emailVerified);
  const verified   = users.filter(u =>  u.emailVerified);

  return (
    <Section
      title="User Management"
      desc="Send verification emails and manage account access across all users."
      icon={<Users size={15} />}
      accent="var(--accent-orange)"
      noPad
    >
      <div style={{ padding: '0 1.5rem 1.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.875rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={load} style={{ gap: '0.375rem' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '1.5rem 0', justifyContent: 'center' }}>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading users…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Unverified */}
            {unverified.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.625rem' }}>
                  <AlertTriangle size={11} style={{ color: 'var(--accent-orange)' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-orange)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    Awaiting Verification ({unverified.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {unverified.map(u => (
                    <div key={u.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      flexWrap: 'wrap', gap: '0.625rem', padding: '0.875rem 1rem',
                      background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.18)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <UserRow u={u} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                        {feedbackId === u.id ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: feedbackOk ? 'var(--accent-teal)' : 'var(--accent-red)' }}>
                            {feedbackMsg}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => sendVerification(u)} disabled={sendingId === u.id} style={{ gap: '0.35rem', fontSize: '0.75rem' }}>
                              {sendingId === u.id
                                ? <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Sending…</>
                                : <><Send size={11} /> Send Email</>}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => markVerified(u)} style={{ gap: '0.35rem', fontSize: '0.75rem' }}>
                              <UserCheck size={11} /> Mark OK
                            </button>
                          </div>
                        )}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Joined {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified */}
            {verified.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.625rem' }}>
                  <CheckCircle2 size={11} style={{ color: 'var(--accent-teal)' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-teal)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    Verified ({verified.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {verified.map(u => (
                    <div key={u.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      flexWrap: 'wrap', gap: '0.5rem', padding: '0.625rem 1rem',
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <UserRow u={u} small />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-teal)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={11} /> Verified
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {users.length === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
                No users found.
              </p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function UserRow({ u, small }: { u: ManagedUser; small?: boolean }) {
  const sz = small ? 28 : 32;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
      <div style={{
        width: sz, height: sz, borderRadius: '50%', flexShrink: 0,
        background: u.role === 'admin'
          ? 'linear-gradient(135deg, var(--accent-orange), #9333ea)'
          : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: small ? '0.65rem' : '0.75rem', fontWeight: 700, color: '#fff',
      }}>
        {u.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: small ? '0.8rem' : '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {u.name}
          {u.role === 'admin' && <Crown size={10} style={{ color: 'var(--accent-orange)' }} />}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.email}
        </div>
      </div>
    </div>
  );
}

/* ── Delete Account ────────────────────────────────────────────── */
function DeleteAccountSection({ headers, onDeleted, onError }: any) {
  const [open,     setOpen]     = useState(false);
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/account`, {
        method: 'DELETE', headers, body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDeleted();
    } catch (e: any) { onError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="card" style={{
      marginBottom: '1rem', overflow: 'hidden',
      border: '1px solid rgba(239,68,68,0.2)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1.125rem 1.5rem',
        background: 'rgba(239,68,68,0.04)',
        borderBottom: '1px solid rgba(239,68,68,0.15)',
        display: 'flex', alignItems: 'center', gap: '0.875rem',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '9px', flexShrink: 0,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trash2 size={15} style={{ color: '#f87171' }} />
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f87171' }}>Danger Zone</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </div>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem' }}>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)',
              color: '#f87171', fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} /> Delete My Account
          </button>
        ) : (
          <form onSubmit={handleDelete} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Enter your password to confirm. All data will be permanently removed and this action cannot be reversed.
            </p>
            <InputField label="Confirm Password" icon={<Lock size={13} />}
              extra={<ToggleVisBtn show={show} toggle={() => setShow(s => !s)} />}>
              <input
                type={show ? 'text' : 'password'} required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Your current password"
                style={{ paddingRight: '2.5rem', borderColor: 'rgba(239,68,68,0.35)' }}
              />
            </InputField>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button type="submit" disabled={loading || !password} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.5rem 1.25rem', border: 'none',
                borderRadius: 'var(--radius-sm)', background: '#ef4444',
                color: '#fff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                opacity: loading || !password ? 0.6 : 1,
              }}>
                <Trash2 size={13} /> {loading ? 'Deleting…' : 'Delete Account'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setPassword(''); }}>
                <X size={13} /> Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Shared primitives ─────────────────────────────────────────── */
function InputField({ label, icon, children, extra }: {
  label: string; icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          {icon}
        </span>
        <div style={{ display: 'contents' }}>
          {React.Children.map(children, child =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<any>, {
                  style: {
                    ...(child.props as any).style,
                    width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box',
                  },
                })
              : child
          )}
        </div>
        {extra}
      </div>
    </div>
  );
}

function ToggleVisBtn({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} style={{
      position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-muted)', padding: 0, display: 'flex',
    }}>
      {show ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
