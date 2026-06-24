import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Bot, User, Zap, Eye, LayoutDashboard, Github, CheckCircle2,
         AlertCircle, ArrowRight, Sparkles, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { n8n as n8nApi } from '../api/client';
import { Build } from '../types';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BuildStep {
  pageId: string;
  name:   string;
  type:   'react' | 'wordpress' | 'unknown';
  ts:     Date;
}

interface Message {
  id:    string;
  role:  'user' | 'assistant' | 'system' | 'complete' | 'progress';
  text:  string;
  ts:    Date;
  meta?: { pageCount?: number; projectName?: string; steps?: BuildStep[] };
}

interface ChatSession {
  id:        string;
  title:     string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  latestBuild: Build | null;
  builds:      Build[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSIONS_KEY       = 'n8n-sessions-v2';
const ACTIVE_SESSION_KEY = 'n8n-active-session';
const COMPLETION_TIMEOUT = 18000;

const EXAMPLES = [
  { icon: '🚗', title: 'Luxury Car Rental',  desc: 'Dark theme, booking system, user accounts' },
  { icon: '🛍️', title: 'E-Commerce Store',   desc: 'Product catalog, cart, payment integration' },
  { icon: '🍕', title: 'Restaurant Website', desc: 'Menu, reservations, online ordering' },
  { icon: '🚀', title: 'SaaS Landing Page',  desc: 'Pricing tables, testimonials, waitlist' },
];

// ── Session helpers ───────────────────────────────────────────────────────────

function msgKey(sessionId: string)  { return `n8n-msgs-${sessionId}`; }
function buildKey(sessionId: string) { return `n8n-building-${sessionId}`; }

function loadSessions(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function loadMessages(sessionId: string): Message[] {
  try {
    const raw = localStorage.getItem(msgKey(sessionId));
    if (!raw) return [];
    return (JSON.parse(raw) as Message[]).map(m => ({ ...m, ts: new Date(m.ts) }));
  } catch { return []; }
}

function saveMessages(sessionId: string, messages: Message[]) {
  localStorage.setItem(msgKey(sessionId), JSON.stringify(messages));
}

function deleteSessionData(sessionId: string) {
  localStorage.removeItem(msgKey(sessionId));
  localStorage.removeItem(buildKey(sessionId));
}

function createSession(): ChatSession {
  return {
    id:        `session-${Date.now()}`,
    title:     'New Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function titleFromMessage(text: string): string {
  const clean = text.replace(/[#*`]/g, '').trim();
  return clean.length > 40 ? clean.slice(0, 40) + '…' : clean || 'New Project';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanPageName(raw: string): string {
  const base = raw.split(/[/\\]/).pop()?.replace(/\.md$/i, '') ?? raw;
  return base.replace(/^\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function detectType(projectName: string): 'react' | 'wordpress' | 'unknown' {
  if (projectName.startsWith('wp_'))  return 'wordpress';
  if (projectName.startsWith('web_')) return 'react';
  return 'unknown';
}

function detectBuildStart(text: string) { return text.includes('[EXECUTE_BUILD]'); }
function cleanBuildTag(text: string)    { return text.replace('[EXECUTE_BUILD]', '').trim(); }

// Module-level: survive React remounts
let _pendingOutput:     string | null    = null;
let _pendingErrText:    string | null    = null;
let _pendingSuggestion: string | undefined;
let _requestInFlight                     = false;

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatPage({ builds }: Props) {
  const navigate = useNavigate();

  // Sessions list
  const [sessions,       setSessions]       = useState<ChatSession[]>(loadSessions);
  const [activeSession,  setActiveSession]  = useState<ChatSession | null>(() => {
    const sessions = loadSessions();
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    return sessions.find(s => s.id === activeId) ?? sessions[0] ?? null;
  });

  // Chat state (per active session)
  const [chatStarted,  setChatStarted]  = useState(false);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [building,     setBuilding]     = useState(false);
  const [n8nConfigured, setN8nConfigured] = useState<boolean | null>(null);

  const bottomRef       = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const prevBuildsCount = useRef(builds.length);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildingRef     = useRef(false);
  const builtPagesRef   = useRef<Build[]>([]);
  const isMountedRef    = useRef(false);
  const activeIdRef     = useRef<string | null>(activeSession?.id ?? null);

  // Keep activeIdRef in sync
  useEffect(() => { activeIdRef.current = activeSession?.id ?? null; }, [activeSession]);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSession) { setMessages([]); setChatStarted(false); setBuilding(false); return; }
    localStorage.setItem(ACTIVE_SESSION_KEY, activeSession.id);
    const msgs = loadMessages(activeSession.id);
    setMessages(msgs);
    setChatStarted(msgs.length > 0);
    setBuilding(localStorage.getItem(buildKey(activeSession.id)) === 'true');
    prevBuildsCount.current = builds.length;
    builtPagesRef.current   = [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  // Persist messages when they change
  useEffect(() => {
    if (activeSession) saveMessages(activeSession.id, messages);
  }, [messages, activeSession]);

  // Persist building flag
  useEffect(() => {
    buildingRef.current = building;
    if (activeSession) {
      if (building) localStorage.setItem(buildKey(activeSession.id), 'true');
      else          localStorage.removeItem(buildKey(activeSession.id));
    }
  }, [building, activeSession]);

  useEffect(() => {
    n8nApi.status().then(s => setN8nConfigured(s.configured)).catch(() => setN8nConfigured(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // ── Session management ──────────────────────────────────────────────────────

  const createAndSwitchSession = useCallback(() => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    const s = createSession();
    setSessions(prev => {
      const next = [s, ...prev];
      saveSessions(next);
      return next;
    });
    setActiveSession(s);
    setInput('');
    setLoading(false);
    setBuilding(false);
    builtPagesRef.current = [];
  }, []);

  const switchToSession = useCallback((session: ChatSession) => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    setLoading(false);
    setBuilding(false);
    setInput('');
    setActiveSession(session);
  }, []);

  const deleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSessionData(sessionId);
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      saveSessions(next);
      return next;
    });
    if (activeSession?.id === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      setActiveSession(remaining[0] ?? null);
    }
  }, [activeSession, sessions]);

  const updateSessionTitle = useCallback((text: string) => {
    if (!activeSession || activeSession.title !== 'New Project') return;
    const title = titleFromMessage(text);
    const updated = { ...activeSession, title, updatedAt: new Date().toISOString() };
    setActiveSession(updated);
    setSessions(prev => {
      const next = prev.map(s => s.id === activeSession.id ? updated : s);
      saveSessions(next);
      return next;
    });
  }, [activeSession]);

  // ── Build tracking ──────────────────────────────────────────────────────────

  const fireCompletion = useCallback(() => {
    if (!buildingRef.current) return;
    setBuilding(false);
    buildingRef.current = false;
    const pages    = builtPagesRef.current;
    const count    = pages.length;
    const projName = pages[0]?.projectName ?? 'your project';
    setMessages(prev => {
      const updated = prev.map(m => m.id === 'build-progress' ? { ...m, id: 'build-progress-done' } : m);
      return [...updated, {
        id: `complete-${Date.now()}`, role: 'complete' as const, text: '', ts: new Date(),
        meta: { pageCount: count, projectName: projName },
      }];
    });
    builtPagesRef.current = [];
  }, []);

  const resetCompletionTimer = useCallback(() => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    completionTimer.current = setTimeout(fireCompletion, COMPLETION_TIMEOUT);
  }, [fireCompletion]);

  useEffect(() => {
    if (builds.length > prevBuildsCount.current && building) {
      const newest = builds[0];
      builtPagesRef.current = [newest, ...builtPagesRef.current];
      const step: BuildStep = {
        pageId: newest.pageId ?? '?',
        name:   cleanPageName(newest.pageName ?? newest.filePath ?? 'Page'),
        type:   detectType(newest.projectName ?? ''),
        ts:     new Date(),
      };
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === 'build-progress');
        if (idx === -1) return prev;
        const card = prev[idx];
        return [...prev.slice(0, idx), { ...card, meta: { ...card.meta, steps: [...(card.meta?.steps ?? []), step] } }, ...prev.slice(idx + 1)];
      });
      resetCompletionTimer();
    }
    prevBuildsCount.current = builds.length;
  }, [builds, building, resetCompletionTimer]);

  useEffect(() => () => { if (completionTimer.current) clearTimeout(completionTimer.current); }, []);

  // ── Message handling ────────────────────────────────────────────────────────

  const addMessage = useCallback((role: Message['role'], text: string) => {
    setMessages(prev => [...prev, { id: `${Date.now()}`, role, text, ts: new Date() }]);
  }, []);

  const processN8nOutput = useCallback((reply: string) => {
    if (detectBuildStart(reply)) {
      const cleanReply = cleanBuildTag(reply);
      if (cleanReply) addMessage('assistant', cleanReply);
      const projMatch = cleanReply.match(/project(?:\s+name)?[:\s]+["']?([A-Za-z0-9 _-]+)/i);
      const projLabel = projMatch?.[1]?.trim() ?? 'your project';
      setMessages(prev => [...prev, {
        id: 'build-progress', role: 'progress' as const, text: projLabel, ts: new Date(),
        meta: { projectName: projLabel, steps: [] },
      }]);
      setBuilding(true);
      builtPagesRef.current = [];
      resetCompletionTimer();
    } else {
      addMessage('assistant', reply);
    }
  }, [addMessage, resetCompletionTimer]);

  // Listen for async PM responses via Socket.IO → window event
  useEffect(() => {
    const handler = (e: Event) => {
      const { output } = (e as CustomEvent<{ output: string }>).detail;
      setLoading(false);
      setChatStarted(true);
      if (isMountedRef.current) {
        processN8nOutput(output);
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        _pendingOutput = output;
      }
    };
    window.addEventListener('n8n:chat-response', handler);
    return () => window.removeEventListener('n8n:chat-response', handler);
  }, [processN8nOutput]);

  useEffect(() => {
    isMountedRef.current = true;
    if (_pendingOutput !== null) {
      const out = _pendingOutput; _pendingOutput = null;
      processN8nOutput(out);
    } else if (_pendingErrText !== null) {
      const errText = _pendingErrText; const suggestion = _pendingSuggestion;
      _pendingErrText = null; _pendingSuggestion = undefined;
      addMessage('system', `Error: ${errText}${suggestion ? `\n${suggestion}` : ''}`);
    }
    return () => { isMountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    // If no session exists yet, create one
    let session = activeSession;
    if (!session) {
      session = createSession();
      setSessions(prev => { const next = [session!, ...prev]; saveSessions(next); return next; });
      setActiveSession(session);
    }
    const greeting: Message = { id: 'greeting', role: 'assistant', ts: new Date(), text: 'Hi there! 👋\nMy name is Nathan. How can I assist you today?' };
    setMessages([greeting]);
    setChatStarted(true);
    setTimeout(() => inputRef.current?.focus(), 100);
    try { await n8nApi.chat('hi', session.id, true); } catch { /* silent */ }
  }, [activeSession]);

  const handleStop = useCallback(async () => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    setLoading(false);
    setBuilding(false);
    _requestInFlight = false;
    addMessage('system', 'Execution stopped by user.');
    try { await n8nApi.stop(); } catch { /* best-effort */ }
  }, [addMessage]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || !activeSession) return;
    setInput('');
    addMessage('user', msg);
    updateSessionTitle(msg);
    setLoading(true);
    _requestInFlight = true;
    let isProcessing = false;
    try {
      const data = await n8nApi.chat(msg, activeSession.id);
      if (data.processing) { isProcessing = true; return; }
      const reply: string = data.output ?? 'No response from n8n.';
      if (isMountedRef.current) processN8nOutput(reply);
      else _pendingOutput = reply;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; suggestion?: string } }; message?: string };
      const serverData = axiosErr?.response?.data;
      const errText = serverData?.error ?? (err instanceof Error ? err.message : 'Connection failed');
      const suggestion = serverData?.suggestion;
      if (isMountedRef.current) addMessage('system', `Error: ${errText}${suggestion ? `\n${suggestion}` : ''}`);
    } finally {
      _requestInFlight = false;
      if (isMountedRef.current && !isProcessing) { setLoading(false); inputRef.current?.focus(); }
    }
  }, [input, loading, activeSession, addMessage, processN8nOutput, updateSessionTitle]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Sessions Sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* New chat button */}
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%', justifyContent: 'center', gap: '0.4rem' }}
            onClick={createAndSwitchSession}
          >
            <Plus size={14} /> New Chat
          </button>
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {sessions.length === 0 && (
            <div style={{ padding: '1rem 0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              No chats yet.<br />Start a new project!
            </div>
          )}
          {sessions.map(session => {
            const isActive = activeSession?.id === session.id;
            return (
              <div
                key={session.id}
                onClick={() => switchToSession(session)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(96,165,250,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(96,165,250,0.25)' : '1px solid transparent',
                  marginBottom: '0.25rem',
                  transition: 'background 0.15s',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <MessageSquare size={13} color={isActive ? 'var(--accent-blue)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '0.775rem', fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {session.title}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={e => deleteSession(session.id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '2px', borderRadius: '3px',
                    display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.6,
                  }}
                  title="Delete chat"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* No session / landing screen */}
        {!chatStarted ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', padding: '2rem', gap: '2rem',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '20px', margin: '0 auto 1.25rem',
                background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(45,212,191,0.25)',
              }}>
                <Sparkles size={34} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                AI Code Pipeline
              </h1>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.625rem', maxWidth: 420, lineHeight: 1.6 }}>
                Describe your website idea and the AI will generate complete React &amp; WordPress implementation prompts.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', width: '100%', maxWidth: 480 }}>
              {EXAMPLES.map((ex, i) => (
                <div key={i} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '0.875rem', cursor: 'default',
                }}>
                  <div style={{ fontSize: '1.25rem', marginBottom: '0.375rem' }}>{ex.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{ex.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{ex.desc}</div>
                </div>
              ))}
            </div>

            {n8nConfigured === false && (
              <div style={{
                background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.25)',
                borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                fontSize: '0.8rem', color: 'var(--accent-orange)', maxWidth: 480, width: '100%',
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span><strong>n8n not connected.</strong> Set <code>N8N_CHAT_URL</code> in Render environment variables.</span>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ padding: '0.875rem 2.5rem', fontSize: '1rem', fontWeight: 600, borderRadius: 'var(--radius-md)' }}
              onClick={handleStart}
            >
              <Zap size={18} /> Start New Project <ArrowRight size={16} />
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generates React + WordPress prompts in 5–6 minutes</p>
          </div>
        ) : (
          <>
            {/* Session header */}
            <div style={{
              padding: '0.5rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {activeSession?.title ?? 'New Project'}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {activeSession?.id.replace('session-', '')}
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {messages.map(m => (
                <ChatBubble key={m.id} message={m} navigate={navigate} />
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                  <Avatar isUser={false} />
                  <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: '0 12px 12px 12px', padding: '0.75rem 1rem',
                    display: 'flex', gap: '4px', alignItems: 'center',
                  }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)',
                        animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`, display: 'inline-block',
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {!loading && _requestInFlight && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)',
                  borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--accent-blue)',
                }}>
                  <span className="spinner" style={{ width: 12, height: 12, borderWidth: '2px', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Pipeline is running — waiting for n8n response…</span>
                  <button
                    onClick={handleStop}
                    style={{
                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '4px', cursor: 'pointer', color: '#ef4444',
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
                    }}
                    title="Stop execution"
                  >
                    <Square size={10} fill="currentColor" /> Stop
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div style={{
              padding: '0.75rem 1.5rem 1.25rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-surface)', flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', gap: '0.625rem', alignItems: 'flex-end',
                background: 'var(--bg-card)', border: '1.5px solid var(--border-bright)',
                borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask Nathan to build, edit, or refine your project…"
                  rows={1}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', resize: 'none',
                    fontSize: '0.875rem', color: 'var(--text-primary)',
                    lineHeight: 1.6, maxHeight: '120px', overflowY: 'auto',
                    outline: 'none', fontFamily: 'var(--font-sans)',
                  }}
                  onInput={e => {
                    const t = e.currentTarget;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                  }}
                  disabled={loading}
                />
                {(loading || building) ? (
                  <button
                    onClick={handleStop}
                    title="Stop execution"
                    style={{
                      flexShrink: 0, alignSelf: 'flex-end',
                      background: 'rgba(239,68,68,0.12)',
                      border: '1.5px solid rgba(239,68,68,0.4)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#ef4444', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                  >
                    <Square size={13} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => send()}
                    disabled={!input.trim()}
                    style={{ flexShrink: 0, alignSelf: 'flex-end', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Send size={13} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'center' }}>
                Press <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0 4px', fontSize: '0.65rem' }}>Enter</kbd>
                {' '}to send &nbsp;·&nbsp;
                <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0 4px', fontSize: '0.65rem' }}>Shift+Enter</kbd>
                {' '}for new line
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ isUser }: { isUser: boolean }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
      background: isUser
        ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
        : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {isUser ? <User size={14} color="#fff" /> : <Bot size={14} color="#fff" />}
    </div>
  );
}

function ChatBubble({ message, navigate }: { message: Message; navigate: ReturnType<typeof useNavigate> }) {
  const isUser = message.role === 'user';

  if (message.role === 'progress' || message.id === 'build-progress-done') {
    const steps  = message.meta?.steps ?? [];
    const isDone = message.id === 'build-progress-done';
    const typeColor = (t: BuildStep['type']) => t === 'react' ? 'var(--accent-blue)' : t === 'wordpress' ? 'var(--accent-purple)' : 'var(--text-muted)';
    const typeLabel = (t: BuildStep['type']) => t === 'react' ? 'React' : t === 'wordpress' ? 'WordPress' : '—';

    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{
          background: 'rgba(96,165,250,0.08)', borderBottom: '1px solid rgba(96,165,250,0.15)',
          padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          {isDone
            ? <CheckCircle2 size={16} color="var(--accent-teal)" />
            : <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, color: 'var(--accent-blue)', flexShrink: 0 }} />
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {isDone ? 'Pipeline complete' : 'Pipeline running…'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
              {steps.length} page{steps.length !== 1 ? 's' : ''} generated{!isDone && ' — more coming…'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }} onClick={() => navigate('/')}>
            <LayoutDashboard size={11} /> Overview
          </button>
        </div>
        <div style={{ padding: '0.625rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.375rem 0.625rem', background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            }}>
              <CheckCircle2 size={13} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '1.5rem', fontFamily: 'var(--font-mono)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', flex: 1, fontWeight: 500 }}>{s.name}</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: typeColor(s.type),
                background: `${typeColor(s.type)}18`, border: `1px solid ${typeColor(s.type)}30`,
                borderRadius: '999px', padding: '0.1rem 0.5rem',
              }}>{typeLabel(s.type)}</span>
            </div>
          ))}
          {!isDone && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.375rem 0.625rem',
              background: 'rgba(96,165,250,0.04)', borderRadius: 'var(--radius-sm)',
              border: '1px dashed rgba(96,165,250,0.25)',
            }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)',
                  animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`, display: 'inline-block', flexShrink: 0,
                }} />
              ))}
              <span style={{ fontSize: '0.775rem', color: 'var(--accent-blue)', fontStyle: 'italic' }}>AI is generating the next page…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role === 'complete') {
    const { pageCount = 0, projectName = 'your project' } = message.meta ?? {};
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{
          background: 'rgba(45,212,191,0.1)', borderBottom: '1px solid rgba(45,212,191,0.2)',
          padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <CheckCircle2 size={18} color="var(--accent-teal)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Build complete!</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
              {pageCount} page{pageCount !== 1 ? 's' : ''} generated for <strong>{projectName}</strong>
            </div>
          </div>
        </div>
        <div style={{ padding: '1rem 1.125rem' }}>
          <p style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.65 }}>
            Your project is ready. You can continue chatting to request edits, or preview the generated files.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }} onClick={() => navigate('/preview')}>
              <Eye size={13} /> Live Preview
            </button>
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} onClick={() => navigate('/')}>
              <LayoutDashboard size={13} /> Overview
            </button>
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} onClick={() => navigate('/github')}>
              <Github size={13} /> GitHub
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    const isError   = message.text.startsWith('Error:') || message.text.startsWith('❌');
    const isSuccess = message.text.startsWith('✅') || message.text.startsWith('🚀');
    const bg     = isError ? 'rgba(248,113,113,0.08)'  : isSuccess ? 'rgba(45,212,191,0.07)'  : 'rgba(96,165,250,0.07)';
    const border = isError ? 'rgba(248,113,113,0.22)'  : isSuccess ? 'rgba(45,212,191,0.2)'   : 'rgba(96,165,250,0.18)';
    const color  = isError ? 'var(--accent-red)'       : isSuccess ? 'var(--accent-teal)'     : 'var(--accent-blue)';
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        padding: '0.5rem 0.875rem', background: bg, border: `1px solid ${border}`,
        borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        <span style={{ color, flexShrink: 0, marginTop: '2px', fontWeight: 700 }}>{isError ? '✕' : '✓'}</span>
        <span dangerouslySetInnerHTML={{ __html: message.text.replace(/^(Error:|❌|✅|🚀)\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <Avatar isUser={isUser} />
      <div style={{
        maxWidth: '76%',
        background: isUser ? 'var(--accent-blue)' : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border)',
        borderRadius: isUser ? '12px 0 12px 12px' : '0 12px 12px 12px',
        padding: '0.75rem 1rem', fontSize: '0.875rem',
        color: isUser ? '#fff' : 'var(--text-primary)',
        lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {message.text}
      </div>
    </div>
  );
}
