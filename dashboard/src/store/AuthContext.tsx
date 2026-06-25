import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface GithubProfile {
  username:     string;
  selectedRepo: string | null;
}

export interface AuthUser {
  id:            string;
  name:          string;
  email:         string;
  role:          'admin' | 'user';
  webhookToken:  string;
  github:        GithubProfile | null;
  emailVerified: boolean;
  createdAt:     string;
}

interface AuthCtx {
  user:        AuthUser | null;
  loading:     boolean;
  error:       string | null;
  register:    (name: string, email: string, password: string) => Promise<AuthUser>;
  login:       (email: string, password: string) => Promise<AuthUser>;
  logout:      () => void;
  refreshUser: () => Promise<AuthUser>;
  getToken:    () => string;
}

const Ctx = createContext<AuthCtx | null>(null);

const TOKEN_KEY = 'n8n-auth-token';
const USER_KEY  = 'n8n-auth-user';
const BASE      = (import.meta.env.VITE_API_URL ?? '') + '/api/auth';

// Callback set by AuthProvider so apiFetch can trigger logout on 401
let _onUnauthorized: (() => void) | null = null;

async function apiFetch(path: string, opts: RequestInit = {}, token?: string) {
  const t   = token ?? localStorage.getItem(TOKEN_KEY) ?? '';
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  // Token expired or revoked — clear session so user is sent to login
  if (res.status === 401 && path !== '/login' && path !== '/register') {
    _onUnauthorized?.();
    throw new Error('Session expired. Please sign in again.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));
  const [error,   setError]   = useState<string | null>(null);

  // Validate stored token on mount — keep loading=true until server confirms
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    apiFetch('/me', {}, token)
      .then(d => { setUser(d.user); localStorage.setItem(USER_KEY, JSON.stringify(d.user)); })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY,  JSON.stringify(data.user));
      setUser(data.user);
      return data.user as AuthUser;
    } catch (e: any) { setError(e.message); throw e; }
    finally { setLoading(false); }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY,  JSON.stringify(data.user));
      setUser(data.user);
      return data.user as AuthUser;
    } catch (e: any) { setError(e.message); throw e; }
    finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Register auto-logout handler so apiFetch can clear session on 401
  useEffect(() => {
    _onUnauthorized = logout;
    return () => { _onUnauthorized = null; };
  }, [logout]);

  const refreshUser = useCallback(async () => {
    const data = await apiFetch('/me');
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY) ?? '', []);

  return (
    <Ctx.Provider value={{ user, loading, error, register, login, logout, refreshUser, getToken }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
