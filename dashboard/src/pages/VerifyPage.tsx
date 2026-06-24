import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader, Zap } from 'lucide-react';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/auth';

type Status = 'loading' | 'success' | 'error';

export default function VerifyPage() {
  const [params]  = useSearchParams();
  const token     = params.get('token') ?? '';
  const [status,  setStatus]  = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in this link.');
      return;
    }
    fetch(`${BASE}/verify/${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json();
        if (r.ok) { setStatus('success'); setMessage(data.message); }
        else       { setStatus('error');   setMessage(data.error ?? 'Verification failed.'); }
      })
      .catch(() => { setStatus('error'); setMessage('Network error — please try again.'); });
  }, [token]);

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          width: 52, height: 52, borderRadius: '14px', margin: '0 auto 1.5rem',
          background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={26} color="#fff" />
        </div>

        <div className="card" style={{ padding: '2.25rem' }}>
          {status === 'loading' && (
            <>
              <Loader size={40} color="var(--accent-blue)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                Verifying your email…
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                Please wait a moment.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 size={48} color="var(--accent-teal)" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                Email Verified!
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
                {message}
              </p>
              <Link to="/login" className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
                Sign In to Dashboard
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={48} color="#f87171" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                Verification Failed
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
                {message}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link to="/login" className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
                  Go to Login
                </Link>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  After logging in, go to <strong>My Profile</strong> to request a new verification email.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
