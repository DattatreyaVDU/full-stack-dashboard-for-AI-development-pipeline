import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import { useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate  = useNavigate();
  const [params]  = useSearchParams();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email.trim(), password);
      const from = params.get('from') ?? '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── Left panel ── */}
      <div style={{
        flex: '0 0 420px', display: 'none',
        background: 'linear-gradient(160deg, #0d1117 0%, #0d2233 50%, #0a1929 100%)',
        padding: '3rem',
        flexDirection: 'column', justifyContent: 'space-between',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }} className="auth-left-panel">

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #0d9488, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f1f5f9' }}>n8n Pipeline</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Code Dashboard</div>
          </div>
        </div>

        {/* Feature list */}
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3, marginBottom: '1.5rem' }}>
            Generate production-ready code with AI
          </h2>
          {[
            { emoji: '⚡', title: 'n8n Pipeline', desc: 'Automated React + WordPress code generation' },
            { emoji: '📁', title: 'GitHub Sync',  desc: 'Files pushed directly to your repository' },
            { emoji: '👁️', title: 'Live Preview', desc: 'Review prompts before building with Cursor' },
            { emoji: '🚀', title: 'One-click Deploy', desc: 'Push to WordPress via FTP instantly' },
          ].map(f => (
            <div key={f.title} style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.125rem' }}>
              <span style={{ fontSize: '1.125rem', flexShrink: 0, marginTop: '1px' }}>{f.emoji}</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{f.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '1px' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '0.72rem', color: '#334155' }}>
          © {new Date().getFullYear()} n8n Pipeline Dashboard
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '2rem' }} className="auth-mobile-logo">
            <div style={{ width: 32, height: 32, borderRadius: '9px', background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>n8n Pipeline</span>
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 2rem' }}>
            Sign in to your dashboard
          </p>

          {error && (
            <div style={{ padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.8125rem', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', paddingLeft: '2.25rem', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '2.5rem', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', gap: '0.5rem' }}>
              {loading ? 'Signing in…' : <><span>Sign In</span><ArrowRight size={14} /></>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--accent-teal)', textDecoration: 'none', fontWeight: 600 }}>Create one free</Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .auth-left-panel { display: flex !important; }
          .auth-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}
