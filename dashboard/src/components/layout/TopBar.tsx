import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, Sun, Moon, LogOut, User, UserCircle, ChevronDown } from 'lucide-react';
import { state as stateApi } from '../../api/client';
import { Theme } from '../../hooks/useTheme';
import { DashboardState } from '../../types';
import { AuthUser } from '../../store/useAuth';

const ROUTES: Record<string, string> = {
  '/chat':            'Website Projects',
  '/chat-webapp':     'Website & Mobile App',
  '/':                'Overview',
  '/preview':         'Live Preview',
  '/github':          'GitHub Integration',
  '/wordpress':       'WordPress Converter',
  '/deploy':          'Deployment',
  '/files':           'File Explorer',
  '/mobile-projects': 'Mobile App Projects',
  '/settings':        'Settings',
  '/profile':         'My Profile',
  '/admin':           'Admin Panel',
};

interface Props {
  lastBuildTime?: string;
  theme: Theme;
  onThemeToggle: () => void;
  onRefresh: (s: DashboardState) => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

function timeAgoShort(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
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
    } catch (_) { /* server offline */ } finally {
      setTimeout(() => setSpinning(false), 600);
    }
  };

  return (
    <header className="topbar">
      {/* Breadcrumb */}
      <div className="topbar-breadcrumb">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dashboard</span>
        <span className="sep">/</span>
        <span className="current">{label}</span>
      </div>

      <div className="topbar-actions">
        {/* Last build time */}
        {lastBuildTime && (
          <span style={{
            fontSize: '0.72rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            padding: '0.2rem 0.6rem', borderRadius: '5px',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', flexShrink: 0 }} />
            {timeAgoShort(lastBuildTime)}
          </span>
        )}

        {/* Theme toggle */}
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onThemeToggle}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        {/* Refresh */}
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={handleRefresh}
          title="Refresh dashboard data"
        >
          <RefreshCw
            size={13}
            style={{
              animation: spinning ? 'spin 0.65s linear infinite' : 'none',
              transformOrigin: 'center',
              transition: 'opacity 0.15s',
              opacity: spinning ? 0.7 : 1,
            }}
          />
        </button>

        {/* User menu */}
        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.25rem 0.5rem 0.25rem 0.25rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: userMenuOpen ? 'var(--bg-card)' : 'transparent',
                cursor: 'pointer',
                transition: 'background var(--transition), border-color var(--transition)',
              }}
              onMouseEnter={e => { if (!userMenuOpen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'; }}
              onMouseLeave={e => { if (!userMenuOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {/* Avatar */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: '0.625rem', fontWeight: 700, color: '#fff',
                letterSpacing: '-0.02em',
              }}>
                {user.name ? getInitials(user.name) : <User size={11} color="#fff" />}
              </div>
              <span style={{
                fontSize: '0.78rem', fontWeight: 500,
                maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: 'var(--text-primary)',
              }}>
                {user.name}
              </span>
              <ChevronDown
                size={12}
                style={{
                  color: 'var(--text-muted)',
                  transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            {userMenuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
                background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 28px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)',
                minWidth: 210, overflow: 'hidden',
                animation: 'slideUpModal 0.16s ease',
              }}>
                {/* User info header */}
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {user.name ? getInitials(user.name) : <User size={13} color="#fff" />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                    </div>
                  </div>
                  {user.github?.selectedRepo && (
                    <div style={{
                      fontSize: '0.68rem', color: 'var(--accent-teal)', marginTop: '0.5rem',
                      background: 'rgba(45,212,191,0.07)', padding: '0.2rem 0.5rem',
                      borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    }}>
                      <span style={{ opacity: 0.7 }}>⎇</span> {user.github.selectedRepo}
                    </div>
                  )}
                </div>

                <div style={{ padding: '0.3rem 0' }}>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                    style={{
                      width: '100%', padding: '0.5rem 1rem', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'left',
                      transition: 'background var(--transition), color var(--transition)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
                  >
                    <UserCircle size={13} style={{ opacity: 0.7 }} /> My Profile
                  </button>

                  <div style={{ height: 1, background: 'var(--border)', margin: '0.25rem 0.75rem' }} />

                  <button
                    onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
                    style={{
                      width: '100%', padding: '0.5rem 1rem', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      fontSize: '0.8rem', color: 'var(--accent-red)', textAlign: 'left',
                      transition: 'background var(--transition)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  >
                    <LogOut size={13} style={{ opacity: 0.8 }} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
