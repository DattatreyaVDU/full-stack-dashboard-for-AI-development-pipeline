import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import { Zap, Mail, Lock, User, Eye, EyeOff, Github, CheckCircle2, Copy, Check, ChevronRight, RefreshCw } from 'lucide-react';

const AUTH_API = (import.meta.env.VITE_API_URL ?? '') + '/api/auth';

const API = (import.meta.env.VITE_API_URL ?? '') + '/api';

type Step = 'account' | 'verify-email' | 'github' | 'repo' | 'done';

export default function RegisterPage() {
  const { register, refreshUser, getToken, loading, error } = useAuth();
  const navigate      = useNavigate();
  const [params]      = useSearchParams();

  const [step, setStep]           = useState<Step>('account');
  const [localErr, setLocalErr]   = useState('');

  // Step 1 fields
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);

  // Step 3 state
  const [repos,        setRepos]        = useState<{ id: number; name: string; fullName: string; private: boolean }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [repoLoading,  setRepoLoading]  = useState(false);
  const [repoSaving,   setRepoSaving]   = useState(false);

  // Step 4 — webhook info
  const [webhookToken, setWebhookToken] = useState('');
  const [copied,       setCopied]       = useState(false);

  // Handle return from GitHub OAuth callback
  useEffect(() => {
    const urlStep  = params.get('step') as Step | null;
    const oauthErr = params.get('error');
    if (!urlStep) return;

    if (oauthErr) {
      setLocalErr(oauthErr === 'access_denied'
        ? 'GitHub access was denied. Please try again.'
        : 'GitHub connection failed. Please try again.');
      setStep('github');
      return;
    }

    if (urlStep === 'repo') {
      setStep('repo');
      loadRepos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1: create account ──────────────────────────────────────────────────
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    if (password !== confirm) { setLocalErr('Passwords do not match'); return; }
    if (password.length < 6)  { setLocalErr('Password must be at least 6 characters'); return; }
    try {
      await register(name.trim(), email.trim(), password);
      setStep('verify-email');
    } catch (err: any) {
      setLocalErr(err.message);
    }
  };

  // ── Step 1b: resend verification email ─────────────────────────────────────
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg,     setResendMsg]     = useState('');
  const handleResend = async () => {
    setResendLoading(true); setResendMsg('');
    try {
      const res  = await fetch(`${AUTH_API}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setResendMsg(data.message ?? 'Sent!');
    } catch {
      setResendMsg('Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // ── Step 2: redirect to GitHub OAuth ───────────────────────────────────────
  const handleGithubConnect = () => {
    const token = getToken();
    window.location.href = `${API}/auth/github/connect?_token=${encodeURIComponent(token)}`;
  };

  // ── Step 3: load repos and select one ──────────────────────────────────────
  const loadRepos = async () => {
    setRepoLoading(true);
    try {
      const res  = await fetch(`${API}/auth/github/repos`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setRepos(data.repos ?? []);
    } catch {
      setLocalErr('Failed to load your GitHub repos. Please refresh.');
    } finally {
      setRepoLoading(false);
    }
  };

  const handleSelectRepo = async () => {
    if (!selectedRepo) { setLocalErr('Please select a repository'); return; }
    setRepoSaving(true); setLocalErr('');
    try {
      await fetch(`${API}/auth/github/select`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ repoFullName: selectedRepo }),
      });
      const user = await refreshUser();
      setWebhookToken(user.webhookToken);
      setStep('done');
    } catch (err: any) {
      setLocalErr(err.message);
    } finally {
      setRepoSaving(false);
    }
  };

  const handleSkipGithub = () => {
    refreshUser().then(u => { setWebhookToken(u.webhookToken); setStep('done'); });
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhook/n8n?userToken=${webhookToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Stepper indicator ───────────────────────────────────────────────────────
  const steps: { id: Step; label: string }[] = [
    { id: 'account',      label: 'Account' },
    { id: 'verify-email', label: 'Verify'  },
    { id: 'github',       label: 'GitHub'  },
    { id: 'repo',         label: 'Repo'    },
    { id: 'done',         label: 'Done'    },
  ];
  const stepIdx = steps.findIndex(s => s.id === step);

  return (
    <div style={{
      height: '100vh',
      background: 'var(--bg-base)',
      overflowY: 'auto',
      padding: '2.5rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '13px', margin: '0 auto 0.875rem',
            background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Create your account
          </h1>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '1.75rem' }}>
          {steps.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700,
                background: i < stepIdx ? 'var(--accent-teal)' : i === stepIdx ? 'var(--accent-blue)' : 'var(--bg-card)',
                color:      i <= stepIdx ? '#fff' : 'var(--text-muted)',
                border:     i === stepIdx ? '2px solid var(--accent-blue)' : '2px solid var(--border)',
                transition: 'all 0.2s',
              }}>
                {i < stepIdx ? <CheckCircle2 size={13} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.7rem', color: i === stepIdx ? 'var(--text-primary)' : 'var(--text-muted)', marginLeft: '0.35rem', fontWeight: i === stepIdx ? 600 : 400 }}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div style={{ width: 28, height: 1, background: i < stepIdx ? 'var(--accent-teal)' : 'var(--border)', margin: '0 0.5rem' }} />
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '1.75rem' }}>
          {(localErr || error) && (
            <div style={{
              padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: '0.8125rem', color: '#f87171',
            }}>
              {localErr || error}
            </div>
          )}

          {/* ── Step 1: Account ── */}
          {step === 'account' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                Your details
              </h2>

              <Field label="Full Name" icon={<User size={14} />}>
                <input type="text" required placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box' }} />
              </Field>

              <Field label="Email" icon={<Mail size={14} />}>
                <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box' }} />
              </Field>

              <Field label="Password" icon={<Lock size={14} />} extra={
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', padding: 0 }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }>
                <input type={showPass ? 'text' : 'password'} required placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '2.5rem', boxSizing: 'border-box' }} />
              </Field>

              <Field label="Confirm Password" icon={<Lock size={14} />}>
                <input type="password" required placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} style={{ width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box' }} />
              </Field>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}>
                {loading ? 'Creating account…' : <>Continue <ChevronRight size={14} /></>}
              </button>
            </form>
          )}

          {/* ── Step 1b: Verify Email ── */}
          {step === 'verify-email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📧</div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
                  Check your inbox
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  We sent a verification link to <strong>{email}</strong>.<br />
                  Click it to activate your account.
                </p>
              </div>

              {resendMsg && (
                <div style={{
                  padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.25)',
                  fontSize: '0.8rem', color: 'var(--accent-teal)',
                }}>
                  {resendMsg}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={() => setStep('github')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Continue to GitHub Setup <ChevronRight size={14} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleResend}
                disabled={resendLoading}
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', gap: '0.4rem' }}
              >
                <RefreshCw size={13} /> {resendLoading ? 'Sending…' : 'Resend verification email'}
              </button>
            </div>
          )}

          {/* ── Step 2: Connect GitHub ── */}
          {step === 'github' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
                  Connect your GitHub
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Generated files from the n8n pipeline will be automatically pushed to a repo you choose.
                </p>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>
                  You'll be asked to authorise access to:
                </div>
                {['Read your repo list', 'Create and update files in selected repo'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    <CheckCircle2 size={12} color="var(--accent-teal)" /> {item}
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" onClick={handleGithubConnect} style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}>
                <Github size={16} /> Connect GitHub
              </button>

              <button className="btn btn-ghost" onClick={handleSkipGithub} style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
                Skip for now — I'll connect later
              </button>
            </div>
          )}

          {/* ── Step 3: Select Repo ── */}
          {step === 'repo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
                  Choose a repository
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Generated <code>.md</code> files will be committed to <code>generated-files/</code> inside this repo.
                </p>
              </div>

              {repoLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading your repos…
                </div>
              ) : (
                <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)} style={{ width: '100%' }}>
                  <option value="">— Select a repository —</option>
                  {repos.map(r => (
                    <option key={r.id} value={r.fullName}>
                      {r.fullName}{r.private ? ' 🔒' : ''}
                    </option>
                  ))}
                </select>
              )}

              <button className="btn btn-primary" onClick={handleSelectRepo} disabled={repoSaving || !selectedRepo} style={{ width: '100%', justifyContent: 'center' }}>
                {repoSaving ? 'Saving…' : <>Use this repo <ChevronRight size={14} /></>}
              </button>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <CheckCircle2 size={40} color="var(--accent-teal)" style={{ marginBottom: '0.75rem' }} />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
                  You're all set!
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Copy your personal webhook URL and paste it into your n8n HTTP Request nodes.
                </p>
              </div>

              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                  YOUR WEBHOOK URL
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <code style={{
                    flex: 1, fontSize: '0.72rem', color: 'var(--accent-blue)',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
                    wordBreak: 'break-all', display: 'block', lineHeight: 1.6,
                  }}>
                    {window.location.origin}/api/webhook/n8n?userToken={webhookToken}
                  </code>
                  <button className="btn btn-ghost btn-sm" onClick={copyWebhookUrl} style={{ flexShrink: 0 }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.625rem 0 0', lineHeight: 1.6 }}>
                  In n8n, replace the existing webhook URL in both <strong>HTTP Request</strong> nodes with this URL. Files will be pushed to your GitHub repo automatically.
                </p>
              </div>

              <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: '100%', justifyContent: 'center' }}>
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

        {step === 'account' && (
          <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-teal)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, icon, children, extra }: { label: string; icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          {icon}
        </span>
        {children}
        {extra}
      </div>
    </div>
  );
}
