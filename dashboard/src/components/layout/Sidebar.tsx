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
          <Zap size={17} color="#fff" strokeWidth={2.5} />
        </div>
        <div className="sidebar-logo-text">
          n8n Pipeline
          <span>Code Dashboard</span>
        </div>
      </div>

      {/* Scrollable nav area */}
      <div className="sidebar-nav-scroll">

        {/* ── Web Pipeline ── */}
        <div className="sidebar-section">
          <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Code2 size={8} style={{ opacity: 0.7 }} /> Web Pipeline
            {buildsCount > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700,
                background: 'rgba(45,212,191,0.15)', color: 'var(--accent-teal)',
                padding: '0.1rem 0.45rem', borderRadius: '999px',
                border: '1px solid rgba(45,212,191,0.2)',
              }}>
                {buildsCount}
              </span>
            )}
          </div>
          <NavLink to="/chat" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <MessageSquare className="nav-icon" size={15} /> Website Projects
          </NavLink>
          <NavLink to="/chat-webapp" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Globe className="nav-icon" size={15} /> Website &amp; Mobile App
          </NavLink>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <LayoutDashboard className="nav-icon" size={15} /> Overview
          </NavLink>
          <NavLink to="/preview" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Eye className="nav-icon" size={15} /> Live Preview
          </NavLink>
          <NavLink to="/github" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Github className="nav-icon" size={15} /> GitHub
          </NavLink>
          <NavLink to="/files" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <FolderOpen className="nav-icon" size={15} /> File Explorer
          </NavLink>
          <NavLink to="/deploy" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Rocket className="nav-icon" size={15} /> Deploy
          </NavLink>
        </div>

        {/* ── WordPress Pipeline ── */}
        <div className="sidebar-section">
          <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={8} style={{ opacity: 0.7 }} /> WordPress Pipeline
            {wpBuildsCount > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700,
                background: 'rgba(167,139,250,0.15)', color: 'var(--accent-purple)',
                padding: '0.1rem 0.45rem', borderRadius: '999px',
                border: '1px solid rgba(167,139,250,0.2)',
              }}>
                {wpBuildsCount}
              </span>
            )}
          </div>
          <NavLink to="/wordpress" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Layers className="nav-icon" size={15} /> WP Projects
          </NavLink>
        </div>

        {/* ── Mobile App Pipeline ── */}
        <div className="sidebar-section">
          <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Smartphone size={8} style={{ opacity: 0.7 }} /> Mobile App Pipeline
          </div>
          <NavLink to="/mobile-projects" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Smartphone className="nav-icon" size={15} /> Mobile App Projects
          </NavLink>
        </div>

        {/* ── System ── */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">System</div>
          <NavLink to="/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <UserCircle className="nav-icon" size={15} /> My Profile
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Settings className="nav-icon" size={15} /> Settings
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <ShieldCheck className="nav-icon" size={15} />
              Admin
              <span style={{
                marginLeft: 'auto', fontSize: '0.58rem', fontWeight: 700,
                background: 'rgba(251,146,60,0.15)', color: 'var(--accent-orange)',
                padding: '0.1rem 0.4rem', borderRadius: '999px',
                border: '1px solid rgba(251,146,60,0.2)',
              }}>
                ADMIN
              </span>
            </NavLink>
          )}
        </div>

      </div>

      {/* Status footer */}
      <div className="sidebar-status">
        <div className="status-row">
          <span className={`status-dot ${serverOnline ? 'online' : ''}`} />
          API Server {serverOnline ? 'Online' : 'Offline'}
        </div>
        <div className="status-row" style={{ marginTop: '3px' }}>
          <Activity size={9} style={{ marginRight: '5px', opacity: 0.45 }} />
          Web: {buildsCount} · WP: {wpBuildsCount}
        </div>
      </div>
    </aside>
  );
}
