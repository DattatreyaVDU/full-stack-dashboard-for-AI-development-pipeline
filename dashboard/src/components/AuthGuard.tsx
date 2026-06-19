import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    if (!user) {
      const from = location.pathname !== '/login' && location.pathname !== '/register'
        ? `?from=${encodeURIComponent(location.pathname)}`
        : '';
      navigate(`/login${from}`, { replace: true });
    }
  }, [user, navigate, location.pathname]);

  if (!user) return null;
  return <>{children}</>;
}
