import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Lock, Github, Zap, Copy, Check, Eye, EyeOff,
  ShieldCheck, ExternalLink, AlertTriangle, CheckCircle2, Crown,
  Trash2, RefreshCw, Send, UserCheck, Users,
} from 'lucide-react';
import { useAuth } from '../store/useAuth';

const API = (import.meta.env.VITE_API_URL ?? '') + '/api';

/* ── small helpers ─────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
      <div style={{ marginBottom: '1.25rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {desc && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.625rem',
      borderRadius: '999px',
      background: ok ? 'rgba(13,148,136,0.12)' : 'rgba(100,116,139,0.12)',
      color:      ok ? 'var(--accent-teal)'     : 'var(--text-muted)',
      border: `1px solid ${ok ? 'rgba(13,148,136,0.25)' : 'var(--border)'}`,
    }}>
      {ok ? '✓ ' : ''}{label}
    </span>
  );
}

/* ── main component ────────────────────────────────────────── */
export default function ProfilePage() {
  const { user, refreshUser, getToken, logout } = useAuth();
  const navigate = useNavigate();

  const [copied,  setCopied]  = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const headers = (extra?: object) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  });

  const copyWebhook = () => {
    if (!user) return;
    navigator.clipboard.writeText(`${window.location.origin}/api/webhook/n8n?userToken=${user.webhookToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  return (
    <div className="page-body" style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999,
          padding: '0.75rem 1.125rem',
          background: toast.ok ? 'rgba(13,148,136,0.95)' : 'rgba(239,68,68,0.92)',
          color: '#fff', borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          fontSize: '0.8125rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header card ── */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: user.role === 'admin'
              ? 'linear-gradient(135deg, #ea580c, #9333ea)'
              : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.375rem', fontWeight: 700, color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}>
            {initials(user.name)}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {user.name}
              </h1>
              {user.role === 'admin' ? (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(234,88,12,0.15)', color: 'var(--accent-orange)', border: '1px solid rgba(234,88,12,0.25)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Crown size={10} /> ADMIN
                </span>
              ) : (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(13,148,136,0.1)', color: 'var(--accent-teal)', border: '1px solid rgba(13,148,136,0.2)' }}>
                  USER
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{user.email}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Member since {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {user.role === 'admin' && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')} style={{ gap: '0.375rem' }}>
              <ShieldCheck size={13} /> Admin Panel
            </button>
          )}
        </div>
      </div>

      {/* ── Personal Info ── */}
      <PersonalInfoSection
        user={user}
        headers={headers()}
        onSuccess={async () => { await refreshUser(); showToast('Profile updated successfully'); }}
        onError={(msg: string) => showToast(msg, false)}
      />

      {/* ── Change Password ── */}
      <PasswordSection
        headers={headers()}
        onSuccess={() => showToast('Password changed successfully')}
        onError={(msg: string) => showToast(msg, false)}
      />

      {/* ── GitHub Integration ── */}
      <GitHubSection
        user={user}
        headers={headers()}
        getToken={getToken}
        onSuccess={async (msg: string) => { await refreshUser(); showToast(msg); }}
        onError={(msg: string) => showToast(msg, false)}
      />

      {/* ── Webhook URL ── */}
      <Section
        title="Your Webhook URL"
        desc="Paste this URL into both HTTP Request nodes in your n8n workflow. Every file your pipeline generates will be automatically pushed to your GitHub repository."
      >
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
            WEBHOOK ENDPOINT
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <code style={{
              flex: 1, fontSize: '0.75rem', color: 'var(--accent-blue)',
              background: 'var(--bg-base)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
              wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {window.location.origin}/api/webhook/n8n?userToken={user.webhookToken}
            </code>
            <button className="btn btn-ghost btn-sm" onClick={copyWebhook} title="Copy webhook URL" style={{ flexShrink: 0 }}>
              {copied ? <Check size={14} color="var(--accent-teal)" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.75rem 0 0', lineHeight: 1.6 }}>
            Keep this URL private. If it's ever exposed, go to the Settings page to generate a new one.
          </p>
        </div>
      </Section>

      {/* ── Email Verification ── */}
      <EmailVerificationSection
        user={user}
        headers={headers()}
        onSuccess={async () => { await refreshUser(); showToast('Verification email sent — check your inbox'); }}
        onError={(msg: string) => showToast(msg, false)}
      />

      {/* ── Admin: User Management ── */}
      {user.role === 'admin' && (
        <AdminUserManagement headers={headers()} />
      )}

      {/* ── Danger Zone ── */}
      <DeleteAccountSection
        headers={headers()}
        onDeleted={() => { logout(); navigate('/login'); }}
        onError={(msg: string) => showToast(msg, false)}
      />

    </div>
  );
}

/* ── Personal Info ─────────────────────────────────────────── */
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
    } catch (e: any) {
      onError(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Section title="Personal Information" desc="Your name and email address shown across the dashboard.">
      {editing ? (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Full Name" icon={<User size={14} />}>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name" style={{ width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box' }} />
          </Field>
          <Field label="Email Address" icon={<Mail size={14} />}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" style={{ width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box' }} />
          </Field>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setName(user.name); setEmail(user.email); }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <InfoRow icon={<User size={14} />}    label="Full Name"      value={user.name} />
          <InfoRow icon={<Mail size={14} />}    label="Email Address"  value={user.email} />
          <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.875rem' }} onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        </div>
      )}
    </Section>
  );
}

/* ── Password ──────────────────────────────────────────────── */
function PasswordSection({ headers, onSuccess, onError }: any) {
  const [open,        setOpen]        = useState(false);
  const [current,     setCurrent]     = useState('');
  const [next,        setNext]        = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext,    setShowNext]    = useState(false);
  const [saving,      setSaving]      = useState(false);

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
    } catch (e: any) {
      onError(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Section title="Security" desc="Change your password. Use a strong password that you don't use anywhere else.">
      {open ? (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Current Password" icon={<Lock size={14} />} extra={
            <ShowHideBtn show={showCurrent} toggle={() => setShowCurrent(p => !p)} />
          }>
            <input type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} required placeholder="Your current password" style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '2.5rem', boxSizing: 'border-box' }} />
          </Field>
          <Field label="New Password" icon={<Lock size={14} />} extra={
            <ShowHideBtn show={showNext} toggle={() => setShowNext(p => !p)} />
          }>
            <input type={showNext ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)} required placeholder="Min 6 characters" style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '2.5rem', boxSizing: 'border-box' }} />
          </Field>
          <Field label="Confirm New Password" icon={<Lock size={14} />}>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat new password" style={{ width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box' }} />
          </Field>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Changing…' : 'Change Password'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setCurrent(''); setNext(''); setConfirm(''); }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Password</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Last changed: unknown</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            Change Password
          </button>
        </div>
      )}
    </Section>
  );
}

/* ── GitHub Integration ────────────────────────────────────── */
function GitHubSection({ user, headers, getToken, onSuccess, onError }: any) {
  const github = user.github;
  const [repos,       setRepos]       = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(github?.selectedRepo ?? '');
  const [savingRepo,   setSavingRepo]   = useState(false);
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
    >
      {!github ? (
        /* Not connected */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Github size={16} color="var(--text-muted)" />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>GitHub not connected</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Connect to enable automatic file commits</div>
            </div>
            <StatusBadge ok={false} label="Not Connected" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={connectGitHub} style={{ gap: '0.4rem' }}>
            <Github size={13} /> Connect GitHub
          </button>
        </div>
      ) : (
        /* Connected */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.625rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Github size={16} color="var(--accent-teal)" />
              </div>
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>@{github.username}</div>
                <StatusBadge ok={true} label="Connected" />
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={disconnectGitHub} style={{ color: '#f87171', fontSize: '0.78rem' }}>
              Disconnect
            </button>
          </div>

          {/* Repo selector */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '0.875rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.3rem', letterSpacing: '0.04em' }}>ACTIVE REPOSITORY</div>
                {github.selectedRepo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code style={{ fontSize: '0.8125rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                      {github.selectedRepo}
                    </code>
                    <a href={`https://github.com/${github.selectedRepo}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-orange)' }}>⚠ No repository selected yet</span>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadRepos} disabled={loadingRepos}>
                {loadingRepos ? 'Loading…' : github.selectedRepo ? 'Change Repo' : 'Select Repo'}
              </button>
            </div>

            {showRepoPicker && (
              <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
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

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Files will be saved to <code>generated-files/&lt;project-name&gt;/</code> in your selected repository every time a build completes.
          </p>
        </div>
      )}
    </Section>
  );
}

/* ── Admin: User Management ────────────────────────────────── */
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
    } catch { showFeedback(u.id, 'Network error — try again', false); }
    finally   { setSendingId(null); }
  };

  const markVerified = async (u: ManagedUser) => {
    try {
      const res  = await fetch(`${ADMIN_API}/users/${u.id}/verify`, { method: 'PATCH', headers });
      const data = await res.json();
      if (data.user) {
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, emailVerified: true } : x));
        showFeedback(u.id, 'Marked as verified ✓', true);
      }
    } catch { showFeedback(u.id, 'Failed — try again', false); }
  };

  const unverified = users.filter(u => !u.emailVerified);
  const verified   = users.filter(u =>  u.emailVerified);

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={15} color="var(--accent-teal)" /> User Management
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            Send verification emails and manage account access
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} style={{ gap: '0.375rem' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '1rem 0' }}>
          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading users…
        </div>
      ) : (
        <>
          {/* Unverified — action needed */}
          {unverified.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-orange)', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <AlertTriangle size={11} /> AWAITING VERIFICATION ({unverified.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {unverified.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: '0.625rem',
                    padding: '0.875rem 1rem',
                    background: 'rgba(251,146,60,0.05)',
                    border: '1px solid rgba(251,146,60,0.2)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {/* User info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {u.name} {u.role === 'admin' && <Crown size={10} color="var(--accent-orange)" />}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                      {feedbackId === u.id ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: feedbackOk ? 'var(--accent-teal)' : '#f87171' }}>
                          {feedbackMsg}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => sendVerification(u)} disabled={sendingId === u.id}
                            style={{ fontSize: '0.75rem', gap: '0.35rem' }}>
                            <Send size={11} /> {sendingId === u.id ? 'Sending…' : 'Send Verification Email'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => markVerified(u)}
                            title="Mark verified without sending email" style={{ fontSize: '0.75rem', gap: '0.35rem' }}>
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

          {/* Verified users */}
          {verified.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-teal)', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <ShieldCheck size={11} /> VERIFIED ({verified.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {verified.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: '0.5rem',
                    padding: '0.625rem 1rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: u.role === 'admin'
                          ? 'linear-gradient(135deg, var(--accent-orange), #9333ea)'
                          : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {u.name} {u.role === 'admin' && <Crown size={10} color="var(--accent-orange)" />}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
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
        </>
      )}
    </div>
  );
}

/* ── Email Verification ────────────────────────────────────── */
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
    <Section title="Email Verification" desc="Verified accounts get access to all dashboard features.">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <StatusBadge ok={user.emailVerified} label={user.emailVerified ? 'Verified' : 'Not Verified'} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{user.email}</span>
        </div>
        {!user.emailVerified && (
          <button className="btn btn-ghost btn-sm" onClick={resend} disabled={loading} style={{ gap: '0.4rem' }}>
            <RefreshCw size={13} /> {loading ? 'Sending…' : 'Resend Verification Email'}
          </button>
        )}
      </div>
      {!user.emailVerified && (
        <p style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', margin: '0.875rem 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertTriangle size={13} /> Check your inbox for the verification email.
        </p>
      )}
    </Section>
  );
}

/* ── Delete Account ────────────────────────────────────────── */
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
        method: 'DELETE', headers,
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDeleted();
    } catch (e: any) { onError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem', border: '1px solid rgba(239,68,68,0.25)' }}>
      <div style={{ marginBottom: open ? '1.25rem' : 0, paddingBottom: open ? '0.875rem' : 0, borderBottom: open ? '1px solid rgba(239,68,68,0.15)' : 'none' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f87171', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trash2 size={15} /> Danger Zone
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
      </div>

      {!open ? (
        <button
          className="btn btn-sm"
          onClick={() => setOpen(true)}
          style={{ marginTop: '1rem', background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', gap: '0.4rem' }}
        >
          <Trash2 size={13} /> Delete My Account
        </button>
      ) : (
        <form onSubmit={handleDelete} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            Enter your password to confirm. All your data will be permanently removed.
          </p>
          <div style={{ position: 'relative' }}>
            <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type={show ? 'text' : 'password'} required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Your current password"
              style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '2.5rem', boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button type="submit" disabled={loading || !password}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Trash2 size={13} /> {loading ? 'Deleting…' : 'Delete Account'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setPassword(''); }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Shared small components ───────────────────────────────── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Field({ label, icon, children, extra }: { label: string; icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>{icon}</span>
        {children}
        {extra}
      </div>
    </div>
  );
}

function ShowHideBtn({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
      {show ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
