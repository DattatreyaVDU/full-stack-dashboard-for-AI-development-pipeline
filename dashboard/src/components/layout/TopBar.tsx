import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Bell, Sun, Moon } from 'lucide-react';
import { state as stateApi } from '../../api/client';
import { Theme } from '../../hooks/useTheme';
import { DashboardState } from '../../types';

const ROUTES: Record<string, string> = {
  '/chat':      'New Project',
  '/':          'Overview',
  '/preview':   'Live Preview',
  '/github':    'GitHub Integration',
  '/wordpress': 'WordPress Converter',
  '/deploy':    'Deployment',
  '/settings':  'Settings',
};

interface Props {
  lastBuildTime?: string;
  theme: Theme;
  onThemeToggle: () => void;
  onRefresh: (s: DashboardState) => void;
}

export default function TopBar({ lastBuildTime, theme, onThemeToggle, onRefresh }: Props) {
  const { pathname } = useLocation();
  const label = ROUTES[pathname] ?? pathname;
  const [spinning, setSpinning] = useState(false);

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
      </div>
    </header>
  );
}
