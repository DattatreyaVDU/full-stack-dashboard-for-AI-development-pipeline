import { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Github, Zap, Clock, Copy, Check, Trash2, RefreshCw, Crown, User, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../store/useAuth';

const API = (import.meta.env.VITE_API_URL ?? '') + '/api/admin';

interface AdminUser {
  id:            string;
  name:          string;
  email:         string;
  role:          'admin' | 'user';
  webhookToken:  string;
  emailVerified: boolean;
  github:        { username: string; selectedRepo: string | null } | null;
  createdAt:     string;
}

interface Stats {
  totalUsers:      number;
  adminCount:      number;
  githubConnected: number;
  totalBuilds:     number;
  uptimeSeconds:   number;
}

function formatUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminPage() {
  const { getToken, user: me } = useAuth();
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [copied,  setCopied]  = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${getToken()}` };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [uRes, sRes] = await Promise.all([
        fetch(`${API}/users`,  { headers }),
        fetch(`${API}/stats`,  { headers }),
      ]);
      const [uData, sData] = await Promise.all([uRes.json(), sRes.json()]);
      if (!uRes.ok) throw new Error(uData.error);
      setUsers(uData.users);
      setStats(sData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyToken = (token: string, id: string) => {
    const url = `${window.location.origin}/api/webhook/n8n?userToken=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await fetch(`${API}/users/${id}`, { method: 'DELETE', headers });
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleResetToken = async (id: string) => {
    const res  = await fetch(`${API}/users/${id}/reset-token`, { method: 'POST', headers });
    const data = await res.json();
    if (data.user) setUsers(prev => prev.map(u => u.id === id ? { ...u, webhookToken: data.user.webhookToken } : u));
  };

  const [sendingVerify, setSendingVerify] = useState<string | null>(null);
  const [verifyMsg,     setVerifyMsg]     = useState<{ id: string; msg: string } | null>(null);

  const handleSendVerification = async (u: AdminUser) => {
    setSendingVerify(u.id); setVerifyMsg(null);
    const res  = await fetch(`${API}/users/${u.id}/send-verification`, { method: 'POST', headers });
    const data = await res.json();
    setSendingVerify(null);
    setVerifyMsg({ id: u.id, msg: data.message ?? (res.ok ? 'Sent!' : data.error) });
    setTimeout(() => setVerifyMsg(null), 4000);
  };

  const handleManualVerify = async (u: AdminUser) => {
    const res  = await fetch(`${API}/users/${u.id}/verify`, { method: 'PATCH', headers });
    const data = await res.json();
    if (data.user) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, emailVerified: true } : x));
  };

  const handleRoleToggle = async (u: AdminUser) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    const res  = await fetch(`${API}/users/${u.id}/role`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (data.user) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: data.user.role } : x));
  };

  return (
    <div className="page-body">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Admin Panel
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            Manage users, GitHub repos, and webhook tokens
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          {[
            { icon: Users,  label: 'Total Users',       value: stats.totalUsers,      color: 'var(--accent-blue)'   },
            { icon: Shield, label: 'Admins',             value: stats.adminCount,      color: 'var(--accent-purple)' },
            { icon: Github, label: 'GitHub Connected',   value: stats.githubConnected, color: 'var(--accent-teal)'   },
            { icon: Zap,    label: 'Total Builds',       value: stats.totalBuilds,     color: 'var(--accent-orange)' },
            { icon: Clock,  label: 'Server Uptime',      value: formatUptime(stats.uptimeSeconds), color: 'var(--accent-teal)' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Icon size={14} color={color} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={14} color="var(--accent-teal)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Registered Users</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>({users.length})</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, display: 'inline-block', marginBottom: '0.75rem' }} />
            <div>Loading users…</div>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No users yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  {['User', 'Role', 'Email', 'GitHub', 'Repo', 'Webhook URL', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>

                    {/* User */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: u.role === 'admin'
                            ? 'linear-gradient(135deg, var(--accent-orange), var(--accent-purple))'
                            : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {u.role === 'admin' ? <Crown size={12} color="#fff" /> : <User size={12} color="#fff" />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {u.name} {u.id === me?.id && <span style={{ fontSize: '0.65rem', color: 'var(--accent-teal)' }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => u.id !== me?.id && handleRoleToggle(u)}
                        disabled={u.id === me?.id}
                        style={{
                          fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                          borderRadius: '999px', border: 'none', cursor: u.id === me?.id ? 'default' : 'pointer',
                          background: u.role === 'admin' ? 'rgba(234,88,12,0.12)' : 'rgba(13,148,136,0.1)',
                          color:      u.role === 'admin' ? 'var(--accent-orange)'  : 'var(--accent-teal)',
                        }}
                        title={u.id === me?.id ? 'Cannot change own role' : `Click to make ${u.role === 'admin' ? 'user' : 'admin'}`}
                      >
                        {u.role === 'admin' ? '⚡ Admin' : 'User'}
                      </button>
                    </td>

                    {/* Email verification */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {u.emailVerified ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-teal)' }}>
                          <ShieldCheck size={12} /> Verified
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', fontWeight: 600 }}>Not verified</span>
                          {verifyMsg?.id === u.id ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-teal)' }}>{verifyMsg.msg}</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              <button className="btn btn-ghost btn-sm" disabled={sendingVerify === u.id}
                                onClick={() => handleSendVerification(u)}
                                title="Send verification email"
                                style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', gap: '0.25rem' }}>
                                <Mail size={10} /> {sendingVerify === u.id ? '…' : 'Send Email'}
                              </button>
                              <button className="btn btn-ghost btn-sm"
                                onClick={() => handleManualVerify(u)}
                                title="Mark as verified manually"
                                style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', gap: '0.25rem' }}>
                                <Check size={10} /> Mark OK
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* GitHub */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {u.github?.username ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <Github size={12} /> @{u.github.username}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not connected</span>
                      )}
                    </td>

                    {/* Repo */}
                    <td style={{ padding: '0.875rem 1rem', maxWidth: 180 }}>
                      {u.github?.selectedRepo ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {u.github.selectedRepo}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Webhook URL */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <code style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          …{u.webhookToken.slice(-8)}
                        </code>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => copyToken(u.webhookToken, u.id)} title="Copy webhook URL">
                          {copied === u.id ? <Check size={11} color="var(--accent-teal)" /> : <Copy size={11} />}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleResetToken(u.id)} title="Reset token">
                          <RefreshCw size={11} />
                        </button>
                      </div>
                    </td>

                    {/* Joined */}
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {u.id !== me?.id && (
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleDelete(u.id, u.name)}
                          title="Delete user"
                          style={{ color: '#f87171' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
