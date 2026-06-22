import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Zap, Eye, LayoutDashboard, Github, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { n8n as n8nApi } from '../api/client';
import { Build } from '../types';
import { useNavigate } from 'react-router-dom';

// Module-level: survive React component remounts (navigate away & back)
let _pendingOutput:     string | null    = null;
let _pendingErrText:    string | null    = null;
let _pendingSuggestion: string | undefined;
let _requestInFlight                     = false;

interface BuildStep {
  pageId:  string;
  name:    string;
  type:    'react' | 'wordpress' | 'unknown';
  ts:      Date;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'complete' | 'progress';
  text: string;
  ts: Date;
  meta?: { pageCount?: number; projectName?: string; steps?: BuildStep[] };
}

function cleanPageName(raw: string): string {
  const base = raw.split(/[/\\]/).pop()?.replace(/\.md$/i, '') ?? raw;
  return base.replace(/^\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function detectType(projectName: string): 'react' | 'wordpress' | 'unknown' {
  if (projectName.startsWith('wp_'))  return 'wordpress';
  if (projectName.startsWith('web_')) return 'react';
  return 'unknown';
}

interface Props {
  latestBuild: Build | null;
  builds: Build[];
}

const STORAGE_SESSION  = 'n8n-chat-session-id';
const STORAGE_MESSAGES = 'n8n-chat-messages';
const STORAGE_STARTED  = 'n8n-chat-started';
const STORAGE_BUILDING = 'n8n-chat-building';

const EXAMPLES = [
  { icon: '🚗', title: 'Luxury Car Rental', desc: 'Dark theme, booking system, user accounts' },
  { icon: '🛍️', title: 'E-Commerce Store', desc: 'Product catalog, cart, payment integration' },
  { icon: '🍕', title: 'Restaurant Website', desc: 'Menu, reservations, online ordering' },
  { icon: '🚀', title: 'SaaS Landing Page', desc: 'Pricing tables, testimonials, waitlist' },
];

const COMPLETION_TIMEOUT = 18000;

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return parsed.map(m => ({ ...m, ts: new Date(m.ts) }));
  } catch { return []; }
}

function loadSessionId(): string {
  const stored = localStorage.getItem(STORAGE_SESSION);
  if (stored) return stored;
  const newId = `session-${Date.now()}`;
  localStorage.setItem(STORAGE_SESSION, newId);
  return newId;
}

function detectBuildStart(text: string): boolean {
  return text.includes('[EXECUTE_BUILD]');
}
function cleanBuildTag(text: string): string {
  return text.replace('[EXECUTE_BUILD]', '').trim();
}

export default function ChatPage({ builds }: Props) {
  const navigate = useNavigate();
  const [chatStarted, setChatStarted] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_STARTED) === 'true';
  });
  const [messages, setMessages]       = useState<Message[]>(loadMessages);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [starting, setStarting]       = useState(false);
  const [building, setBuilding]       = useState<boolean>(() => {
    // Restore building state if user navigated away mid-pipeline
    if (localStorage.getItem(STORAGE_BUILDING) !== 'true') return false;
    // Only restore if an in-progress card exists in stored messages
    try {
      const msgs = JSON.parse(localStorage.getItem(STORAGE_MESSAGES) || '[]') as Message[];
      return msgs.some(m => m.id === 'build-progress');
    } catch { return false; }
  });
  const [sessionId, setSessionId]     = useState<string>(loadSessionId);
  const [n8nConfigured, setN8nConfigured] = useState<boolean | null>(null);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const prevBuildsCount  = useRef(builds.length);
  const completionTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildingRef      = useRef(false);
  const builtPagesRef    = useRef<Build[]>([]);
  const isMountedRef     = useRef(false);

  useEffect(() => {
    buildingRef.current = building;
    if (building) {
      localStorage.setItem(STORAGE_BUILDING, 'true');
    } else {
      localStorage.removeItem(STORAGE_BUILDING);
    }
  }, [building]);

  // On mount: if we restored building=true, skip already-received builds so we
  // don't duplicate steps in the progress card, and restart the completion timer.
  const didRestoreBuilding = useRef(false);
  useEffect(() => {
    if (!building || didRestoreBuilding.current) return;
    didRestoreBuilding.current = true;
    buildingRef.current = true;
    // Skip builds already shown in the persisted progress card
    prevBuildsCount.current = builds.length;
    // Repopulate builtPagesRef so fireCompletion has project name / count
    builtPagesRef.current = builds.slice();
    // Restart timer — pipeline may already be done, fire after timeout
    resetCompletionTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    n8nApi.status()
      .then(s => setN8nConfigured(s.configured))
      .catch(() => setN8nConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fireCompletion = useCallback(() => {
    if (!buildingRef.current) return;
    setBuilding(false);
    buildingRef.current = false;
    localStorage.removeItem(STORAGE_BUILDING);
    const pages    = builtPagesRef.current;
    const count    = pages.length;
    const projName = pages[0]?.projectName ?? 'your project';
    // Mark progress card as done, then add completion card
    setMessages(prev => {
      const updated = prev.map(m =>
        m.id === 'build-progress' ? { ...m, id: 'build-progress-done' } : m
      );
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

      // Update the single progress card instead of adding new messages
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === 'build-progress');
        if (idx === -1) return prev;
        const card = prev[idx];
        return [
          ...prev.slice(0, idx),
          { ...card, meta: { ...card.meta, steps: [...(card.meta?.steps ?? []), step] } },
          ...prev.slice(idx + 1),
        ];
      });

      resetCompletionTimer();
    }
    prevBuildsCount.current = builds.length;
  }, [builds, building, resetCompletionTimer]);

  useEffect(() => () => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  const addMessage = useCallback((role: Message['role'], text: string) => {
    setMessages(prev => [...prev, { id: `${Date.now()}`, role, text, ts: new Date() }]);
  }, []);

  // Process a successful n8n chat response (shared by send() and mount recovery)
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

  // Listen for async PM responses relayed from n8n via Socket.IO → window event
  useEffect(() => {
    const handler = (e: Event) => {
      const { output } = (e as CustomEvent<{ output: string }>).detail;
      setLoading(false);
      setStarting(false);
      // Ensure chat screen is open (covers the handleStart async path)
      setChatStarted(true);
      localStorage.setItem(STORAGE_STARTED, 'true');
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

  // On mount: consume any response that arrived while we were on another page
  useEffect(() => {
    isMountedRef.current = true;
    if (_pendingOutput !== null) {
      const out = _pendingOutput;
      _pendingOutput = null;
      processN8nOutput(out);
    } else if (_pendingErrText !== null) {
      const errText = _pendingErrText;
      const suggestion = _pendingSuggestion;
      _pendingErrText = null;
      _pendingSuggestion = undefined;
      addMessage('system', `❌ **Error:** ${errText}${suggestion ? `\n💡 ${suggestion}` : ''}`);
    }
    return () => { isMountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click "Start New Project" → show greeting instantly, no n8n round-trip needed
  const handleStart = useCallback(() => {
    setMessages([{
      id: 'greeting', role: 'assistant', ts: new Date(),
      text: 'Hi there! 👋\nMy name is Nathan. How can I assist you today?',
    }]);
    setChatStarted(true);
    localStorage.setItem(STORAGE_STARTED, 'true');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // "+ New Chat" → wipe everything and go back to landing
  const startNewChat = useCallback(() => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    const newId = `session-${Date.now()}`;
    localStorage.setItem(STORAGE_SESSION, newId);
    localStorage.removeItem(STORAGE_MESSAGES);
    localStorage.removeItem(STORAGE_STARTED);
    setSessionId(newId);
    setMessages([]);
    setBuilding(false);
    setChatStarted(false);
    builtPagesRef.current = [];
  }, []);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    addMessage('user', msg);
    setLoading(true);
    _requestInFlight = true;
    let isProcessing = false;
    try {
      const data = await n8nApi.chat(msg, sessionId);
      if (data.processing) {
        // n8n async — PM response arrives via 'n8n:chat-response' window event.
        // Keep loading=true; the socket handler will clear it.
        isProcessing = true;
        return;
      }
      const reply: string = data.output ?? 'No response from n8n.';
      _pendingOutput = reply;
      _pendingErrText = null;
      if (isMountedRef.current) {
        _pendingOutput = null;
        processN8nOutput(reply);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; suggestion?: string } }; message?: string };
      const serverData = axiosErr?.response?.data;
      const errText = serverData?.error ?? (err instanceof Error ? err.message : 'Connection failed');
      const suggestion = serverData?.suggestion;
      _pendingErrText = errText;
      _pendingSuggestion = suggestion;
      _pendingOutput = null;
      if (isMountedRef.current) {
        _pendingErrText = null;
        _pendingSuggestion = undefined;
        addMessage('system', `❌ **Error:** ${errText}${suggestion ? `\n💡 ${suggestion}` : ''}`);
      }
    } finally {
      _requestInFlight = false;
      if (isMountedRef.current && !isProcessing) {
        setLoading(false);
        inputRef.current?.focus();
      }
    }
  }, [input, loading, sessionId, addMessage, processN8nOutput]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Landing screen ─────────────────────────────────────────────────────────
  if (!chatStarted) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '2rem', gap: '2rem',
      }}>
        {/* Icon + title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '20px', margin: '0 auto 1.25rem',
            background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(45,212,191,0.25)',
          }}>
            <Sparkles size={34} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
            AI Code Pipeline
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.625rem', maxWidth: 420, lineHeight: 1.6 }}>
            Describe your website idea and the AI will generate complete React &amp; WordPress implementation prompts — ready to run in Cursor.
          </p>
        </div>

        {/* Example cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', width: '100%', maxWidth: 480 }}>
          {EXAMPLES.map((ex, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.875rem',
              cursor: 'default',
            }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.375rem' }}>{ex.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{ex.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{ex.desc}</div>
            </div>
          ))}
        </div>

        {/* n8n warning if not configured */}
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

        {/* Start button */}
        <button
          className="btn btn-primary"
          style={{ padding: '0.875rem 2.5rem', fontSize: '1rem', fontWeight: 600, gap: '0.625rem', borderRadius: 'var(--radius-md)' }}
          onClick={handleStart}
          disabled={starting}
        >
          {starting
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: '2px' }} /> Starting pipeline...</>
            : <><Zap size={18} /> Start New Project <ArrowRight size={16} /></>
          }
        </button>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Generates React + WordPress prompts in 5–6 minutes
        </p>
      </div>
    );
  }

  // ── Chat screen ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Session bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.6rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          session: {sessionId.replace('session-', '')}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={startNewChat} title="Clear history and start a new project">
          + New Chat
        </button>
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
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--accent-teal)',
                  animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  display: 'inline-block',
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Show when a request is in flight but user navigated away and came back */}
        {!loading && _requestInFlight && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.875rem',
            background: 'rgba(96,165,250,0.07)',
            border: '1px solid rgba(96,165,250,0.18)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem', color: 'var(--accent-blue)',
          }}>
            <span className="spinner" style={{ width: 12, height: 12, borderWidth: '2px', color: 'var(--accent-blue)', flexShrink: 0 }} />
            Pipeline is running — waiting for n8n response…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '0.75rem 1.5rem 1.25rem',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', gap: '0.625rem', alignItems: 'flex-end',
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-bright)',
          borderRadius: 'var(--radius-md)',
          padding: '0.625rem 0.75rem',
          transition: 'border-color var(--transition)',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe your project — style, features, database needs, languages..."
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
          <button
            className="btn btn-primary btn-sm"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{ flexShrink: 0, alignSelf: 'flex-end', borderRadius: 'var(--radius-sm)' }}
          >
            {loading
              ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: '2px' }} />
              : <Send size={13} />
            }
          </button>
        </div>
        <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'center' }}>
          Press{' '}
          <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0 4px', fontSize: '0.65rem' }}>Enter</kbd>
          {' '}to send &nbsp;·&nbsp;
          <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0 4px', fontSize: '0.65rem' }}>Shift+Enter</kbd>
          {' '}for new line
        </div>
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

  // ── Build progress card ──
  if (message.role === 'progress' || message.id === 'build-progress-done') {
    const steps    = message.meta?.steps ?? [];
    const isDone   = message.id === 'build-progress-done';
    const typeColor = (t: BuildStep['type']) =>
      t === 'react' ? 'var(--accent-blue)' : t === 'wordpress' ? 'var(--accent-purple)' : 'var(--text-muted)';
    const typeLabel = (t: BuildStep['type']) =>
      t === 'react' ? 'React' : t === 'wordpress' ? 'WordPress' : '—';

    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
      }}>
        {/* Header */}
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
              {steps.length} page{steps.length !== 1 ? 's' : ''} generated
              {!isDone && ' — more coming…'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }} onClick={() => navigate('/')}>
              <LayoutDashboard size={11} /> Overview
            </button>
          </div>
        </div>

        {/* Steps list */}
        <div style={{ padding: '0.625rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.375rem 0.625rem',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              <CheckCircle2 size={13} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '1.5rem', fontFamily: 'var(--font-mono)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', flex: 1, fontWeight: 500 }}>
                {s.name}
              </span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: typeColor(s.type),
                background: `${typeColor(s.type)}18`,
                border: `1px solid ${typeColor(s.type)}30`,
                borderRadius: '999px', padding: '0.1rem 0.5rem',
              }}>
                {typeLabel(s.type)}
              </span>
            </div>
          ))}

          {/* Pulsing "next up" row while still building */}
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
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--accent-blue)',
                  animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  display: 'inline-block', flexShrink: 0,
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
            Your project is ready. Preview the generated pages, review them in the Overview dashboard, or commit to GitHub.
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
    const isError   = message.text.startsWith('❌');
    const isSuccess = message.text.startsWith('✅') || message.text.startsWith('🚀');
    const bg     = isError ? 'rgba(248,113,113,0.08)'  : isSuccess ? 'rgba(45,212,191,0.07)'  : 'rgba(96,165,250,0.07)';
    const border = isError ? 'rgba(248,113,113,0.22)'  : isSuccess ? 'rgba(45,212,191,0.2)'   : 'rgba(96,165,250,0.18)';
    const color  = isError ? 'var(--accent-red)'       : isSuccess ? 'var(--accent-teal)'     : 'var(--accent-blue)';
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        padding: '0.5rem 0.875rem', background: bg,
        border: `1px solid ${border}`, borderRadius: 'var(--radius-sm)',
        fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        <span style={{ color, flexShrink: 0, marginTop: '2px', fontWeight: 700 }}>
          {isError ? '✕' : '✓'}
        </span>
        <span dangerouslySetInnerHTML={{ __html: message.text
          .replace(/^[❌✅🚀]\s*/, '')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        }} />
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
        padding: '0.75rem 1rem',
        fontSize: '0.875rem',
        color: isUser ? '#fff' : 'var(--text-primary)',
        lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {message.text}
      </div>
    </div>
  );
}
