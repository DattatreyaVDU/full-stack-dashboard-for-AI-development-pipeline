import { useState, useEffect, useCallback } from 'react';

export interface GithubProfile {
  username:     string;
  selectedRepo: string | null;
}

export interface AuthUser {
  id:           string;
  name:         string;
  email:        string;
  webhookToken: string;
  github:       GithubProfile | null;
  createdAt:    string;
}

const TOKEN_KEY = 'n8n-auth-token';
const USER_KEY  = 'n8n-auth-user';

const API = (import.meta.env.VITE_API_URL ?? '') + '/api/auth';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res   = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function useAuth() {
  const [user,  setUser]  = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Validate stored token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || user) return;
    apiFetch('/me')
      .then(d => { setUser(d.user); localStorage.setItem(USER_KEY, JSON.stringify(d.user)); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('/register', {
        method: 'POST',
        body:   JSON.stringify({ name, email, password }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY,  JSON.stringify(data.user));
      setUser(data.user);
      return data.user as AuthUser;
    } catch (e: any) {
      setError(e.message); throw e;
    } finally { setLoading(false); }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body:   JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY,  JSON.stringify(data.user));
      setUser(data.user);
      return data.user as AuthUser;
    } catch (e: any) {
      setError(e.message); throw e;
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await apiFetch('/me');
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const getToken = () => localStorage.getItem(TOKEN_KEY) ?? '';

  return { user, loading, error, register, login, logout, refreshUser, getToken };
}
