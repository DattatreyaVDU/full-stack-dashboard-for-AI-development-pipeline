import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      const from = location.pathname !== '/login' && location.pathname !== '/register'
        ? `?from=${encodeURIComponent(location.pathname)}`
        : '';
      navigate(`/login${from}`, { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-base)' }}>
      <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  );

  if (!user) return null;
  return <>{children}</>;
}
