import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Square, Bot, User, Zap, Eye, LayoutDashboard, Github,
  CheckCircle2, AlertCircle, ArrowRight, Sparkles, Plus,
  MessageSquare, Trash2, Clock, Cpu, Wifi, Database, Code2,
  FileOutput, PackageCheck, BrainCircuit, ChevronRight, Activity,
} from 'lucide-react';
import { n8n as n8nApi } from '../api/client';
import { Build } from '../types';
import { useNavigate } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  pipeline?: 'web' | 'webapp';
}

interface Props {
  latestBuild:   Build | null;
  builds:        Build[];
  pipelineType?: 'web' | 'webapp';
}

// ── Constants ──────────────────────────────────────────────────────────────────

const COMPLETION_TIMEOUT = 18000;

const EXAMPLES_WEB = [
  { icon: '🚗', title: 'Luxury Car Rental',  desc: 'Dark theme, booking & user accounts' },
  { icon: '🛍️', title: 'E-Commerce Store',   desc: 'Catalog, cart, payment integration' },
  { icon: '🍕', title: 'Restaurant Website', desc: 'Menu, reservations, online ordering' },
  { icon: '🚀', title: 'SaaS Landing Page',  desc: 'Pricing, testimonials, waitlist' },
];

const EXAMPLES_APP = [
  { icon: '💪', title: 'Fitness Tracker App',   desc: 'Workouts, progress, nutrition log' },
  { icon: '💳', title: 'Finance Dashboard App', desc: 'Budgets, spending, analytics' },
  { icon: '📚', title: 'Learning Platform App', desc: 'Courses, quizzes, certificates' },
  { icon: '🏠', title: 'Real Estate App',        desc: 'Listings, map search, booking' },
];

// Rotating status messages shown while n8n is processing
const WORKFLOW_STEPS: { icon: React.ElementType; label: string; after: number }[] = [
  { icon: Zap,         label: 'Initializing workflow…',      after: 0   },
  { icon: Wifi,        label: 'Connecting to AI provider…',  after: 5   },
  { icon: BrainCircuit, label: 'Analyzing requirements…',   after: 12  },
  { icon: Database,    label: 'Searching knowledge base…',   after: 22  },
  { icon: Cpu,         label: 'Processing your request…',    after: 35  },
  { icon: Code2,       label: 'Generating response…',        after: 50  },
  { icon: FileOutput,  label: 'Structuring content…',        after: 75  },
  { icon: PackageCheck, label: 'Finalising output…',         after: 100 },
];

// ── Session helpers ─────────────────────────────────────────────────────────────

function msgKey(sessionId: string)   { return `n8n-msgs-${sessionId}`; }
function buildKey(sessionId: string) { return `n8n-building-${sessionId}`; }

function loadSessions(key: string, pipeline: 'web' | 'webapp'): ChatSession[] {
  try {
    const all: ChatSession[] = JSON.parse(localStorage.getItem(key) || '[]');
    return all.filter(s => (s.pipeline ?? 'web') === pipeline);
  } catch { return []; }
}
function saveSessions(key: string, sessions: ChatSession[]) {
  localStorage.setItem(key, JSON.stringify(sessions));
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
function createSession(pipeline: 'web' | 'webapp'): ChatSession {
  return {
    id: `session-${Date.now()}`, title: 'New Project',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    pipeline,
  };
}
function titleFromMessage(text: string): string {
  const clean = text.replace(/[#*`]/g, '').trim();
  return clean.length > 40 ? clean.slice(0, 40) + '…' : clean || 'New Project';
}

// ── Misc helpers ────────────────────────────────────────────────────────────────

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
function fmtElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// Module-level: survive React remounts
let _pendingOutput:     string | null    = null;
let _pendingErrText:    string | null    = null;
let _pendingSuggestion: string | undefined;
let _requestInFlight                     = false;

// ── Main Component ──────────────────────────────────────────────────────────────

export default function ChatPage({ builds, pipelineType = 'web' }: Props) {
  const navigate   = useNavigate();
  const isWebapp   = pipelineType === 'webapp';
  const SESSIONS_KEY       = isWebapp ? 'n8n-webapp-sessions-v1' : 'n8n-sessions-v2';
  const ACTIVE_SESSION_KEY = isWebapp ? 'n8n-webapp-active-session' : 'n8n-active-session';
  const apiChat    = isWebapp ? n8nApi.chatMobile  : n8nApi.chat;
  const apiStatus  = isWebapp ? n8nApi.statusMobile : n8nApi.status;

  const [sessions,      setSessions]      = useState<ChatSession[]>(() => loadSessions(SESSIONS_KEY, isWebapp ? 'webapp' : 'web'));
  const [activeSession, setActiveSession] = useState<ChatSession | null>(() => {
    const all      = loadSessions(SESSIONS_KEY, isWebapp ? 'webapp' : 'web');
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    return all.find(s => s.id === activeId) ?? all[0] ?? null;
  });
  const [chatStarted,   setChatStarted]   = useState(false);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [building,      setBuilding]      = useState(false);
  const [n8nConfigured, setN8nConfigured] = useState<boolean | null>(null);

  // Elapsed timer while loading
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const bottomRef       = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const prevBuildsCount = useRef(builds.length);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildingRef     = useRef(false);
  const builtPagesRef   = useRef<Build[]>([]);
  const isMountedRef    = useRef(false);
  const activeIdRef     = useRef<string | null>(activeSession?.id ?? null);

  // Start/stop elapsed timer with loading state
  useEffect(() => {
    if (loading) {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    } else {
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [loading]);

  useEffect(() => { activeIdRef.current = activeSession?.id ?? null; }, [activeSession]);

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

  useEffect(() => {
    if (activeSession) saveMessages(activeSession.id, messages);
  }, [messages, activeSession]);

  useEffect(() => {
    buildingRef.current = building;
    if (activeSession) {
      if (building) localStorage.setItem(buildKey(activeSession.id), 'true');
      else          localStorage.removeItem(buildKey(activeSession.id));
    }
  }, [building, activeSession]);

  useEffect(() => {
    apiStatus().then(s => setN8nConfigured(s.configured)).catch(() => setN8nConfigured(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebapp]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // ── Session management ────────────────────────────────────────────────────────

  const createAndSwitchSession = useCallback(() => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    const s = createSession(isWebapp ? 'webapp' : 'web');
    setSessions(prev => { const next = [s, ...prev]; saveSessions(SESSIONS_KEY, next); return next; });
    setActiveSession(s);
    setInput('');
    setLoading(false);
    setBuilding(false);
    builtPagesRef.current = [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebapp, SESSIONS_KEY]);

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
      saveSessions(SESSIONS_KEY, next);
      return next;
    });
    if (activeSession?.id === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      setActiveSession(remaining[0] ?? null);
    }
  }, [activeSession, sessions]);

  const updateSessionTitle = useCallback((text: string) => {
    if (!activeSession || activeSession.title !== 'New Project') return;
    const title   = titleFromMessage(text);
    const updated = { ...activeSession, title, updatedAt: new Date().toISOString() };
    setActiveSession(updated);
    setSessions(prev => {
      const next = prev.map(s => s.id === activeSession.id ? updated : s);
      saveSessions(SESSIONS_KEY, next);
      return next;
    });
  }, [activeSession]);

  // ── Build tracking ────────────────────────────────────────────────────────────

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
        const idx  = prev.findIndex(m => m.id === 'build-progress');
        if (idx === -1) return prev;
        const card = prev[idx];
        return [...prev.slice(0, idx), { ...card, meta: { ...card.meta, steps: [...(card.meta?.steps ?? []), step] } }, ...prev.slice(idx + 1)];
      });
      resetCompletionTimer();
    }
    prevBuildsCount.current = builds.length;
  }, [builds, building, resetCompletionTimer]);

  useEffect(() => () => { if (completionTimer.current) clearTimeout(completionTimer.current); }, []);

  // ── Message handling ──────────────────────────────────────────────────────────

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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ output?: string }>).detail;
      const output = detail?.output;
      if (!output || typeof output !== 'string') return;
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

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    let session = activeSession;
    if (!session) {
      session = createSession(isWebapp ? 'webapp' : 'web');
      setSessions(prev => { const next = [session!, ...prev]; saveSessions(SESSIONS_KEY, next); return next; });
      setActiveSession(session);
    }
    const greeting: Message = {
      id: 'greeting', role: 'assistant', ts: new Date(),
      text: 'Hi there! 👋\nMy name is Nathan. How can I assist you today?',
    };
    setMessages([greeting]);
    setChatStarted(true);
    setTimeout(() => inputRef.current?.focus(), 100);
    try { await apiChat('hi', session.id, true); } catch { /* silent wakeup */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, apiChat]);

  const handleStop = useCallback(async () => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    setLoading(false);
    setBuilding(false);
    _requestInFlight = false;
    addMessage('system', 'Execution stopped by user.');
    if (!isWebapp) {
      try { await n8nApi.stop(); } catch { /* best-effort */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, isWebapp]);

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
      const data = await apiChat(msg, activeSession.id);
      if (data.processing) { isProcessing = true; return; }
      const reply: string = data.output ?? 'No response from n8n.';
      if (isMountedRef.current) processN8nOutput(reply);
      else _pendingOutput = reply;
    } catch (err: unknown) {
      const axiosErr  = err as { response?: { data?: { error?: string; suggestion?: string } }; message?: string };
      const serverData = axiosErr?.response?.data;
      const errText   = serverData?.error ?? (err instanceof Error ? err.message : 'Connection failed');
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

  const EXAMPLES = isWebapp ? EXAMPLES_APP : EXAMPLES_WEB;
  const pipelineLabel  = isWebapp ? 'Website + App Pipeline' : 'Website Pipeline';
  const pipelineAccent = isWebapp ? 'var(--accent-purple)' : 'var(--accent-teal)';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>

      {/* ══ Sessions Sidebar ══════════════════════════════════════════════════════ */}
      <aside style={{
        width: 230, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-sidebar, var(--bg-surface))',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '0.875rem 0.875rem 0.75rem',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {/* Pipeline badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            marginBottom: '0.625rem',
            fontSize: '0.65rem', fontWeight: 700,
            color: pipelineAccent, letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>
            <Activity size={10} />
            {pipelineLabel}
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%', justifyContent: 'center', gap: '0.4rem' }}
            onClick={createAndSwitchSession}
          >
            <Plus size={13} /> New Chat
          </button>
        </div>

        {/* Session count */}
        {sessions.length > 0 && (
          <div style={{
            padding: '0.4rem 0.875rem 0.2rem',
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            {sessions.length} project{sessions.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.375rem 0.5rem 0.5rem' }}>
          {sessions.length === 0 && (
            <div style={{
              padding: '2rem 1rem', textAlign: 'center',
              fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              <MessageSquare size={20} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
              <div>No chats yet.</div>
              <div>Start your first project!</div>
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
                  background: isActive ? `color-mix(in srgb, ${pipelineAccent} 10%, transparent)` : 'transparent',
                  border: isActive ? `1px solid color-mix(in srgb, ${pipelineAccent} 28%, transparent)` : '1px solid transparent',
                  marginBottom: '0.2rem',
                  transition: 'background 0.15s, border-color 0.15s',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '6px', flexShrink: 0,
                  background: isActive ? `color-mix(in srgb, ${pipelineAccent} 18%, transparent)` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? `color-mix(in srgb, ${pipelineAccent} 30%, transparent)` : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageSquare size={11} style={{ color: isActive ? pipelineAccent : 'var(--text-muted)' }} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '0.775rem', fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {session.title}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {new Date(session.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={e => deleteSession(session.id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '2px', borderRadius: '3px',
                    display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0,
                    transition: 'opacity 0.15s',
                  }}
                  className="session-delete-btn"
                  title="Delete chat"
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ══ Chat Area ════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>

        {/* Welcome screen */}
        {!chatStarted ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <div style={{
              minHeight: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '2rem', gap: '1.5rem',
            }}>

              {/* Hero */}
              <div style={{ textAlign: 'center', maxWidth: 480 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '18px', margin: '0 auto 1.125rem',
                  background: isWebapp
                    ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))'
                    : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isWebapp
                    ? '0 8px 32px rgba(167,139,250,0.3), 0 0 0 1px rgba(167,139,250,0.2)'
                    : '0 8px 32px rgba(45,212,191,0.3), 0 0 0 1px rgba(45,212,191,0.2)',
                }}>
                  <Sparkles size={28} color="#fff" />
                </div>

                <h1 style={{
                  fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em',
                  margin: 0, lineHeight: 1.2,
                  background: isWebapp
                    ? 'linear-gradient(135deg, #a78bfa, #60a5fa)'
                    : 'linear-gradient(135deg, #2dd4bf, #60a5fa)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {isWebapp ? 'Website + Mobile App' : 'AI Code Pipeline'}
                </h1>

                <p style={{
                  fontSize: '0.9rem', color: 'var(--text-secondary)',
                  marginTop: '0.625rem', lineHeight: 1.65, maxWidth: 400, margin: '0.625rem auto 0',
                }}>
                  {isWebapp
                    ? 'Generate a full website and React Native mobile app together. Describe your idea and the pipeline handles the rest.'
                    : 'Describe your website idea and the AI pipeline generates complete React & WordPress implementation prompts in minutes.'}
                </p>
              </div>

              {/* n8n warning */}
              {n8nConfigured === false && (
                <div style={{
                  background: 'rgba(251,146,60,.07)', border: '1px solid rgba(251,146,60,.25)',
                  borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.8rem', color: 'var(--accent-orange)', maxWidth: 480, width: '100%',
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>n8n not connected.</strong> Set{' '}
                    <code>{isWebapp ? 'N8N_MOBILE_CHAT_URL' : 'N8N_CHAT_URL'}</code> in environment variables.
                  </span>
                </div>
              )}

              {/* Example cards */}
              <div style={{ width: '100%', maxWidth: 480 }}>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '0.625rem',
                }}>
                  Example projects
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => { handleStart(); setTimeout(() => setInput(ex.title), 300); }}
                      style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', padding: '0.875rem',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
                        display: 'flex', flexDirection: 'column', gap: '0.3rem',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = pipelineAccent;
                        el.style.background  = 'var(--bg-card-hover, rgba(255,255,255,0.04))';
                        el.style.transform   = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = 'var(--border)';
                        el.style.background  = 'var(--bg-card)';
                        el.style.transform   = 'translateY(0)';
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>{ex.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{ex.title}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{ex.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start CTA */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '0.8rem 2.5rem', fontSize: '0.9375rem', fontWeight: 700,
                    borderRadius: 'var(--radius-md)', gap: '0.5rem',
                    background: isWebapp
                      ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))'
                      : undefined,
                    boxShadow: isWebapp
                      ? '0 4px 20px rgba(167,139,250,0.3)'
                      : '0 4px 20px rgba(45,212,191,0.2)',
                  }}
                  onClick={handleStart}
                >
                  <Zap size={16} /> Start New Project <ArrowRight size={15} />
                </button>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                  {isWebapp ? 'Generates Website + React Native app in ~8 minutes' : 'Generates React + WordPress prompts in ~5 minutes'}
                </p>
              </div>
            </div>
          </div>

        ) : (
          <>
            {/* ── Session header ─────────────────────────────────────── */}
            <div style={{
              padding: '0.625rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                background: `color-mix(in srgb, ${pipelineAccent} 15%, transparent)`,
                border: `1px solid color-mix(in srgb, ${pipelineAccent} 30%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageSquare size={13} style={{ color: pipelineAccent }} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                {activeSession?.title ?? 'New Project'}
              </span>
              {(loading || building) && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: 'rgba(96,165,250,0.1)',
                  border: '1px solid rgba(96,165,250,0.25)',
                  color: 'var(--accent-blue)',
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)',
                    animation: 'statusPulse 1.4s ease-in-out infinite',
                  }} />
                  Running
                </span>
              )}
            </div>

            {/* ── Messages ───────────────────────────────────────────── */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '1.375rem 1.5rem',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}>
              {messages.map(m => (
                <ChatBubble key={m.id} message={m} navigate={navigate} pipelineAccent={pipelineAccent} />
              ))}

              {/* Live workflow status — never a blank screen */}
              {loading && (
                <WorkflowStatusCard
                  elapsed={elapsed}
                  isWebapp={isWebapp}
                  onStop={handleStop}
                />
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input ──────────────────────────────────────────────── */}
            <div style={{
              padding: '0.875rem 1.5rem 1.25rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-surface)', flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', gap: '0.625rem', alignItems: 'flex-end',
                background: 'var(--bg-card)',
                border: `1.5px solid ${loading || building ? `color-mix(in srgb, ${pipelineAccent} 40%, var(--border))` : 'var(--border-bright, var(--border))'}`,
                borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem',
                transition: 'border-color 0.2s',
                boxShadow: (loading || building)
                  ? `0 0 0 3px color-mix(in srgb, ${pipelineAccent} 8%, transparent)`
                  : 'none',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={loading ? 'Pipeline is running — response incoming…' : 'Ask Nathan to build, edit, or refine your project…'}
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
                      borderRadius: 'var(--radius-sm)', color: '#ef4444',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, transition: 'background 0.15s',
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
                <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0 4px', fontSize: '0.65rem' }}>Enter</kbd>
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
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes progressFill {
          from { width: 0%; }
          to   { width: var(--progress-width); }
        }
        .session-delete-btn:hover { opacity: 1 !important; color: var(--accent-red) !important; }
      `}</style>
    </div>
  );
}

// ── WorkflowStatusCard ─────────────────────────────────────────────────────────

function WorkflowStatusCard({
  elapsed, isWebapp, onStop,
}: {
  elapsed: number;
  isWebapp: boolean;
  onStop: () => void;
}) {
  // Determine which step we're on based on elapsed seconds
  const stepIdx = WORKFLOW_STEPS.reduce((acc, step, i) => elapsed >= step.after ? i : acc, 0);
  const step    = WORKFLOW_STEPS[stepIdx];
  const StepIcon = step.icon;

  // Smooth progress: interpolate between current and next step's `after` thresholds
  const next     = WORKFLOW_STEPS[stepIdx + 1];
  const segStart = step.after;
  const segEnd   = next?.after ?? 130;
  const pct      = Math.min(100, Math.round(((elapsed - segStart) / (segEnd - segStart)) * 100));
  const overallPct = Math.min(98, Math.round((stepIdx / (WORKFLOW_STEPS.length - 1)) * 85 + pct * 0.15));

  const accent = isWebapp ? 'var(--accent-purple)' : 'var(--accent-blue)';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
      animation: 'fadeSlideUp 0.3s ease',
    }}>
      {/* AI avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(45,212,191,0.3)',
      }}>
        <Bot size={15} color="#fff" />
      </div>

      {/* Status card */}
      <div style={{
        flex: 1, maxWidth: '82%',
        background: 'var(--bg-card)', border: `1px solid color-mix(in srgb, ${accent} 25%, var(--border))`,
        borderRadius: '0 14px 14px 14px', overflow: 'hidden',
      }}>
        {/* Card header */}
        <div style={{
          padding: '0.75rem 1rem',
          background: `color-mix(in srgb, ${accent} 6%, var(--bg-surface))`,
          borderBottom: `1px solid color-mix(in srgb, ${accent} 15%, var(--border))`,
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
            background: `color-mix(in srgb, ${accent} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
          }}>
            <StepIcon size={14} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {step.label}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              AI pipeline is working on your request
            </div>
          </div>
          {/* Status + elapsed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
              color: accent,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'currentColor',
                animation: 'statusPulse 1.4s ease-in-out infinite',
              }} />
              Running
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            }}>
              <Clock size={10} />
              {fmtElapsed(elapsed)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '0.75rem 1rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Step {stepIdx + 1} of {WORKFLOW_STEPS.length}
            </span>
            <span style={{ fontSize: '0.68rem', color: accent, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {overallPct}%
            </span>
          </div>
          <div style={{
            height: 4, background: 'var(--bg-base)',
            borderRadius: '999px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${overallPct}%`,
              borderRadius: '999px',
              background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 60%, var(--accent-teal)))`,
              transition: 'width 1s ease',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite',
            }} />
          </div>
        </div>

        {/* Steps checklist */}
        <div style={{ padding: '0.625rem 1rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {WORKFLOW_STEPS.map((s, i) => {
            const done    = i < stepIdx;
            const current = i === stepIdx;
            const pending = i > stepIdx;
            const SIcon   = s.icon;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.3rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: current ? `color-mix(in srgb, ${accent} 6%, transparent)` : 'transparent',
                border: current ? `1px solid color-mix(in srgb, ${accent} 15%, transparent)` : '1px solid transparent',
                transition: 'background 0.3s',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: done    ? 'rgba(45,212,191,0.15)' :
                              current ? `color-mix(in srgb, ${accent} 18%, transparent)` :
                              'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${
                    done    ? 'rgba(45,212,191,0.4)' :
                    current ? `color-mix(in srgb, ${accent} 40%, transparent)` :
                    'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done ? (
                    <CheckCircle2 size={10} style={{ color: 'var(--accent-teal)' }} />
                  ) : current ? (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: accent, animation: 'statusPulse 1s ease-in-out infinite',
                    }} />
                  ) : (
                    <SIcon size={9} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                  )}
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: current ? 600 : 400,
                  color: done ? 'var(--accent-teal)' :
                         current ? 'var(--text-primary)' :
                         'var(--text-muted)',
                  opacity: pending ? 0.55 : 1,
                }}>
                  {s.label}
                </span>
                {current && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '3px', flexShrink: 0 }}>
                    {[0,1,2].map(j => (
                      <span key={j} style={{
                        width: 4, height: 4, borderRadius: '50%', background: accent,
                        animation: `dotPulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                        display: 'inline-block',
                      }} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: stop button */}
        <div style={{
          padding: '0.5rem 1rem 0.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: `1px solid color-mix(in srgb, ${accent} 10%, var(--border))`,
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Typically completes in 5–8 minutes. You can leave this page — results are saved.
          </span>
          <button
            onClick={onStop}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.3rem 0.7rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-sm)', color: '#ef4444',
              fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          >
            <Square size={10} fill="currentColor" /> Stop
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ isUser }: { isUser: boolean }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: isUser
        ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
        : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: isUser
        ? '0 2px 8px rgba(96,165,250,0.3)'
        : '0 2px 8px rgba(45,212,191,0.3)',
    }}>
      {isUser ? <User size={14} color="#fff" /> : <Bot size={14} color="#fff" />}
    </div>
  );
}

// ── ChatBubble ─────────────────────────────────────────────────────────────────

function ChatBubble({
  message, navigate, pipelineAccent,
}: {
  message: Message;
  navigate: ReturnType<typeof useNavigate>;
  pipelineAccent: string;
}) {
  const isUser = message.role === 'user';

  // ── Build progress card ─────────────────────────────────────────────────────
  if (message.role === 'progress' || message.id === 'build-progress-done') {
    const steps  = message.meta?.steps ?? [];
    const isDone = message.id === 'build-progress-done';
    const typeColor = (t: BuildStep['type']) =>
      t === 'react' ? 'var(--accent-blue)' : t === 'wordpress' ? 'var(--accent-purple)' : 'var(--text-muted)';
    const typeLabel = (t: BuildStep['type']) =>
      t === 'react' ? 'React' : t === 'wordpress' ? 'WP' : '—';

    return (
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isDone ? 'rgba(45,212,191,0.3)' : 'rgba(96,165,250,0.25)'}`,
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        animation: 'fadeSlideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          background: isDone ? 'rgba(45,212,191,0.08)' : 'rgba(96,165,250,0.07)',
          borderBottom: `1px solid ${isDone ? 'rgba(45,212,191,0.2)' : 'rgba(96,165,250,0.15)'}`,
          padding: '0.875rem 1.125rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          {isDone
            ? <CheckCircle2 size={18} color="var(--accent-teal)" />
            : <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, color: 'var(--accent-blue)', flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {isDone ? `✓ Pipeline complete — ${message.text}` : `Building "${message.text}"…`}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {steps.length} page{steps.length !== 1 ? 's' : ''} generated{!isDone && ' — more incoming'}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.7rem', gap: '0.3rem' }}
            onClick={() => navigate('/')}
          >
            <LayoutDashboard size={11} />
            <span>Overview</span>
            <ChevronRight size={10} />
          </button>
        </div>

        {/* Progress bar */}
        {!isDone && steps.length > 0 && (
          <div style={{ padding: '0.5rem 1.125rem 0' }}>
            <div style={{ height: 3, background: 'var(--bg-base)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '999px',
                background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-teal))',
                width: `${Math.min(95, steps.length * 12)}%`,
                transition: 'width 0.6s ease',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
              }} />
            </div>
          </div>
        )}

        {/* Steps list */}
        <div style={{ padding: '0.625rem 1.125rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.375rem 0.625rem',
              background: 'var(--bg-base)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              animation: 'fadeSlideUp 0.25s ease',
            }}>
              <CheckCircle2 size={13} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '1.5rem', fontFamily: 'var(--font-mono)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', flex: 1, fontWeight: 500 }}>{s.name}</span>
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                color: typeColor(s.type),
                background: `${typeColor(s.type)}18`,
                border: `1px solid ${typeColor(s.type)}30`,
              }}>
                {typeLabel(s.type)}
              </span>
            </div>
          ))}

          {!isDone && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.375rem 0.625rem',
              background: 'rgba(96,165,250,0.04)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed rgba(96,165,250,0.25)',
            }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)',
                  animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`, flexShrink: 0,
                }} />
              ))}
              <span style={{ fontSize: '0.775rem', color: 'var(--accent-blue)', fontStyle: 'italic' }}>
                AI is generating the next page…
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Complete card ───────────────────────────────────────────────────────────
  if (message.role === 'complete') {
    const { pageCount = 0, projectName = 'your project' } = message.meta ?? {};
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid rgba(45,212,191,0.3)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        animation: 'fadeSlideUp 0.3s ease',
      }}>
        <div style={{
          background: 'rgba(45,212,191,0.08)', borderBottom: '1px solid rgba(45,212,191,0.2)',
          padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
            background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle2 size={20} color="var(--accent-teal)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Build complete! 🎉
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <strong>{pageCount}</strong> page{pageCount !== 1 ? 's' : ''} generated for <strong>{projectName}</strong>
            </div>
          </div>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.65, margin: '0 0 1rem' }}>
            Your project is ready. Continue chatting to request edits, or use the buttons below to preview and deploy.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" style={{ gap: '0.375rem' }} onClick={() => navigate('/preview')}>
              <Eye size={13} /> Live Preview
            </button>
            <button className="btn btn-ghost btn-sm" style={{ gap: '0.375rem' }} onClick={() => navigate('/')}>
              <LayoutDashboard size={13} /> Overview
            </button>
            <button className="btn btn-ghost btn-sm" style={{ gap: '0.375rem' }} onClick={() => navigate('/github')}>
              <Github size={13} /> GitHub
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── System message ──────────────────────────────────────────────────────────
  if (message.role === 'system') {
    const isError   = message.text.startsWith('Error:') || message.text.startsWith('❌');
    const isSuccess = message.text.startsWith('✅') || message.text.startsWith('🚀');
    const bg     = isError ? 'rgba(248,113,113,0.07)'  : isSuccess ? 'rgba(45,212,191,0.07)'  : 'rgba(96,165,250,0.07)';
    const border = isError ? 'rgba(248,113,113,0.22)'  : isSuccess ? 'rgba(45,212,191,0.2)'   : 'rgba(96,165,250,0.18)';
    const color  = isError ? 'var(--accent-red)'       : isSuccess ? 'var(--accent-teal)'     : 'var(--accent-blue)';
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        padding: '0.625rem 0.875rem', background: bg, border: `1px solid ${border}`,
        borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
        color: 'var(--text-secondary)', lineHeight: 1.6,
        animation: 'fadeSlideUp 0.2s ease',
      }}>
        <span style={{ color, flexShrink: 0, marginTop: '2px', fontWeight: 700, fontSize: '0.9rem' }}>
          {isError ? '✕' : '✓'}
        </span>
        <span dangerouslySetInnerHTML={{
          __html: message.text
            .replace(/^(Error:|❌|✅|🚀)\s*/, '')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
        }} />
      </div>
    );
  }

  // ── Regular user / assistant bubble ────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
      flexDirection: isUser ? 'row-reverse' : 'row',
      animation: 'fadeSlideUp 0.2s ease',
    }}>
      <Avatar isUser={isUser} />
      <div style={{
        maxWidth: '76%',
        background: isUser ? pipelineAccent : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border)',
        borderRadius: isUser ? '14px 0 14px 14px' : '0 14px 14px 14px',
        padding: '0.75rem 1rem', fontSize: '0.875rem',
        color: isUser ? '#fff' : 'var(--text-primary)',
        lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        boxShadow: isUser ? `0 2px 12px color-mix(in srgb, ${pipelineAccent} 25%, transparent)` : 'none',
      }}>
        {message.text}
      </div>
    </div>
  );
}
