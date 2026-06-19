import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Eye, Github, Layers, Rocket,
  Settings, Zap, Activity, MessageSquare, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../store/useAuth';

interface Props {
  serverOnline: boolean;
  buildsCount: number;
}

const navItems = [
  { to: '/chat',      icon: MessageSquare,  label: 'New Project' },
  { to: '/',          icon: LayoutDashboard, label: 'Overview' },
  { to: '/preview',   icon: Eye,             label: 'Live Preview' },
  { to: '/github',    icon: Github,          label: 'GitHub' },
  { to: '/wordpress', icon: Layers,          label: 'WordPress' },
  { to: '/deploy',    icon: Rocket,          label: 'Deploy' },
];

export default function Sidebar({ serverOnline, buildsCount }: Props) {
  const { user } = useAuth();
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={16} color="#fff" />
        </div>
        <div className="sidebar-logo-text">
          n8n Pipeline
          <span>Code Dashboard</span>
        </div>
      </div>

      {/* Main nav */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Workspace</div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon className="nav-icon" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-section" style={{ marginTop: '0.25rem' }}>
        <div className="sidebar-section-label">System</div>
        <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Settings className="nav-icon" />
          Settings
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <ShieldCheck className="nav-icon" />
            Admin
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(234,88,12,0.15)', color: 'var(--accent-orange)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
              ADMIN
            </span>
          </NavLink>
        )}
      </div>

      {/* Status footer */}
      <div className="sidebar-status">
        <div className="status-row">
          <span className={`status-dot ${serverOnline ? 'online' : ''}`} />
          API Server {serverOnline ? 'Online' : 'Offline'}
        </div>
        <div className="status-row" style={{ marginTop: '4px' }}>
          <Activity size={10} style={{ marginRight: '6px', opacity: 0.5 }} />
          {buildsCount} build{buildsCount !== 1 ? 's' : ''} received
        </div>
      </div>
    </aside>
  );
}
