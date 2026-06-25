import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, Bell, Sun, Moon, LogOut, User, UserCircle } from 'lucide-react';
import { state as stateApi } from '../../api/client';
import { Theme } from '../../hooks/useTheme';
import { DashboardState } from '../../types';
import { AuthUser } from '../../store/useAuth';

const ROUTES: Record<string, string> = {
  '/chat':      'New Project',
  '/':          'Overview',
  '/preview':   'Live Preview',
  '/github':    'GitHub Integration',
  '/wordpress': 'WordPress Converter',
  '/deploy':    'Deployment',
  '/files':     'File Explorer',
  '/settings':  'Settings',
  '/profile':   'My Profile',
  '/admin':     'Admin Panel',
};

interface Props {
  lastBuildTime?: string;
  theme: Theme;
  onThemeToggle: () => void;
  onRefresh: (s: DashboardState) => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export default function TopBar({ lastBuildTime, theme, onThemeToggle, onRefresh, user, onLogout }: Props) {
  const { pathname } = useLocation();
  const navigate      = useNavigate();
  const label = ROUTES[pathname] ?? pathname;
  const [spinning,     setSpinning]     = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleRefresh = async () => {
    setSpinning(true);
    try {
      const fresh = await stateApi.get();
      onRefresh(fresh);
    } catch (_) {
      // server offline — ignore
    } finally {
      setTimeout(() => setSpinning(false), 600);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        <span>Dashboard</span>
        <span className="sep">/</span>
        <span className="current">{label}</span>
      </div>

      <div className="topbar-actions">
        {lastBuildTime && (
          <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
            Last build: {new Date(lastBuildTime).toLocaleTimeString()}
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onThemeToggle}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={handleRefresh}
          title="Refresh dashboard data"
        >
          <RefreshCw
            size={14}
            style={{
              animation: spinning ? 'spin 0.6s linear' : 'none',
              transformOrigin: 'center',
            }}
          />
        </button>
        <button className="btn btn-ghost btn-sm btn-icon" title="Notifications">
          <Bell size={14} />
        </button>

        {/* User menu */}
        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setUserMenuOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.625rem' }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <User size={11} color="#fff" />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 500, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </span>
            </button>

            {userMenuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                minWidth: 200, overflow: 'hidden',
              }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
                  {user.github?.selectedRepo && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-teal)', marginTop: '0.25rem' }}>
                      📁 {user.github.selectedRepo}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                  style={{ width: '100%', padding: '0.625rem 1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <UserCircle size={13} /> View Profile
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '0.25rem 0' }} />
                <button
                  onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
                  style={{ width: '100%', padding: '0.625rem 1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#f87171', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
