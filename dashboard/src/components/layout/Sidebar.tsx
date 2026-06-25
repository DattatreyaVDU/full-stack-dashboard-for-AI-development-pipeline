import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Eye, Github, Layers, Rocket,
  Settings, Zap, Activity, MessageSquare, ShieldCheck, UserCircle, Code2, FolderOpen,
  Smartphone, Globe,
} from 'lucide-react';
import { useAuth } from '../../store/useAuth';

interface Props {
  serverOnline:  boolean;
  buildsCount:   number;
  wpBuildsCount: number;
}

export default function Sidebar({ serverOnline, buildsCount, wpBuildsCount }: Props) {
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

      {/* ── Web Pipeline ── */}
      <div className="sidebar-section">
        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Code2 size={9} style={{ opacity: 0.6 }} /> Web Pipeline
          {buildsCount > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(13,148,136,0.15)', color: 'var(--accent-teal)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
              {buildsCount}
            </span>
          )}
        </div>
        <NavLink to="/chat" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <MessageSquare className="nav-icon" /> Website Projects
        </NavLink>
        <NavLink to="/chat-webapp" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Globe className="nav-icon" /> Website &amp; Mobile App
        </NavLink>
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <LayoutDashboard className="nav-icon" /> Overview
        </NavLink>
        <NavLink to="/preview" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Eye className="nav-icon" /> Live Preview
        </NavLink>
        <NavLink to="/github" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Github className="nav-icon" /> GitHub
        </NavLink>
        <NavLink to="/files" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <FolderOpen className="nav-icon" /> File Explorer
        </NavLink>
        <NavLink to="/deploy" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Rocket className="nav-icon" /> Deploy
        </NavLink>
      </div>

      {/* ── WordPress Pipeline ── */}
      <div className="sidebar-section" style={{ marginTop: '0.25rem' }}>
        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Layers size={9} style={{ opacity: 0.6 }} /> WordPress Pipeline
          {wpBuildsCount > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
              {wpBuildsCount}
            </span>
          )}
        </div>
        <NavLink to="/wordpress" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Layers className="nav-icon" /> WP Projects
        </NavLink>
      </div>

      {/* ── Mobile App Pipeline ── */}
      <div className="sidebar-section" style={{ marginTop: '0.25rem' }}>
        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Smartphone size={9} style={{ opacity: 0.6 }} /> Mobile App Pipeline
        </div>
        <NavLink to="/mobile-projects" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Smartphone className="nav-icon" /> Mobile App Projects
        </NavLink>
      </div>

      {/* ── System ── */}
      <div className="sidebar-section" style={{ marginTop: '0.25rem' }}>
        <div className="sidebar-section-label">System</div>
        <NavLink to="/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <UserCircle className="nav-icon" /> My Profile
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Settings className="nav-icon" /> Settings
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
          Web: {buildsCount} · WP: {wpBuildsCount}
        </div>
      </div>
    </aside>
  );
}
