import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Zap, Eye, Code2, AlertCircle, ExternalLink, Github, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { n8n as n8nApi } from '../api/client';
import { Build } from '../types';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'complete';
  text: string;
  ts: Date;
  meta?: { pageCount: number; projectName: string };
}

interface Props {
  latestBuild: Build | null;
  builds: Build[];
}

const STORAGE_SESSION  = 'n8n-chat-session-id';
const STORAGE_MESSAGES = 'n8n-chat-messages';

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  text: "Hi! I'm your AI project manager. Tell me about the website or app you want to build — describe the idea, style, features, and any specific requirements. I'll ask a few questions if needed, then launch the full build pipeline automatically.",
  ts: new Date(),
};

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as Message[];
    return parsed.map(m => ({ ...m, ts: new Date(m.ts) }));
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function loadSessionId(): string {
  const stored = localStorage.getItem(STORAGE_SESSION);
  if (stored) return stored;
  const newId = `session-${Date.now()}`;
  localStorage.setItem(STORAGE_SESSION, newId);
  return newId;
}

const STARTER_PROMPTS = [
  'Build a luxury car rental website with dark theme, booking system and user accounts',
  'Create an e-commerce store with product catalog, cart and payment integration',
  'I need a SaaS landing page with pricing tables, testimonials and waitlist form',
  'Build a restaurant website with menu, reservations and online ordering',
];

function detectBuildStart(text: string): boolean {
  return text.includes('[EXECUTE_BUILD]');
}

function cleanBuildTag(text: string): string {
  return text.replace('[EXECUTE_BUILD]', '').trim();
}

// How long with no new build before we declare completion (ms)
const COMPLETION_TIMEOUT = 18000;

export default function ChatPage({ latestBuild, builds }: Props) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [sessionId, setSessionId] = useState<string>(loadSessionId);
  const [n8nConfigured, setN8nConfigured] = useState<boolean | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const prevBuildsCount  = useRef(builds.length);
  const completionTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildingRef      = useRef(false); // stable ref for timer callbacks
  const builtPagesRef    = useRef<Build[]>([]);

  // Keep ref in sync with state
  useEffect(() => { buildingRef.current = building; }, [building]);

  // Check n8n status on mount
  useEffect(() => {
    n8nApi.status()
      .then(s => setN8nConfigured(s.configured))
      .catch(() => setN8nConfigured(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Called when no new build arrives within COMPLETION_TIMEOUT while building
  const fireCompletion = useCallback(() => {
    if (!buildingRef.current) return;
    setBuilding(false);
    buildingRef.current = false;

    const pages    = builtPagesRef.current;
    const count    = pages.length;
    const projName = pages[0]?.projectName ?? 'your project';

    setMessages(prev => [...prev, {
      id:   `complete-${Date.now()}`,
      role: 'complete',
      text: '',
      ts:   new Date(),
      meta: { pageCount: count, projectName: projName },
    }]);
    builtPagesRef.current = [];
  }, []);

  // Reset the completion countdown every time a new build arrives
  const resetCompletionTimer = useCallback(() => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    completionTimer.current = setTimeout(fireCompletion, COMPLETION_TIMEOUT);
  }, [fireCompletion]);

  // Detect new builds while pipeline is running
  useEffect(() => {
    if (builds.length > prevBuildsCount.current && building) {
      const newest = builds[0];
      builtPagesRef.current = [newest, ...builtPagesRef.current];

      setMessages(prev => [...prev, {
        id:   `build-${newest.id}`,
        role: 'system',
        text: `✅ **${newest.pageName}** generated — ${newest.projectName}`,
        ts:   new Date(),
      }]);

      resetCompletionTimer();
    }
    prevBuildsCount.current = builds.length;
  }, [builds, building, resetCompletionTimer]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
  }, []);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  const addMessage = useCallback((role: Message['role'], text: string) => {
    setMessages(prev => [...prev, { id: `${Date.now()}`, role, text, ts: new Date() }]);
  }, []);

  const startNewChat = useCallback(() => {
    if (completionTimer.current) clearTimeout(completionTimer.current);
    const newId = `session-${Date.now()}`;
    localStorage.setItem(STORAGE_SESSION, newId);
    localStorage.removeItem(STORAGE_MESSAGES);
    setSessionId(newId);
    setMessages([WELCOME_MESSAGE]);
    setBuilding(false);
    builtPagesRef.current = [];
  }, []);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    addMessage('user', msg);
    setLoading(true);

    try {
      const data = await n8nApi.chat(msg, sessionId);
      const reply: string = data.output ?? 'No response from n8n.';

      if (detectBuildStart(reply)) {
        const cleanReply = cleanBuildTag(reply);
        if (cleanReply) addMessage('assistant', cleanReply);
        addMessage('system', '🚀 **Build pipeline launched!** Pages are being generated now — each one will appear below as it completes.');
        setBuilding(true);
        builtPagesRef.current = [];
        resetCompletionTimer();
      } else {
        addMessage('assistant', reply);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; suggestion?: string } }; message?: string };
      const serverData = axiosErr?.response?.data;
      const errText = serverData?.error ?? (err instanceof Error ? err.message : 'Connection failed');
      const suggestion = serverData?.suggestion;
      addMessage('system', `❌ **Error:** ${errText}${suggestion ? `\n💡 ${suggestion}` : ''}`);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, sessionId, addMessage, resetCompletionTimer]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

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

      {/* n8n not configured warning */}
      {n8nConfigured === false && (
        <div style={{
          background: 'rgba(251,146,60,.08)',
          border: '1px solid rgba(251,146,60,.25)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          margin: '1rem 1.5rem 0',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          fontSize: '0.8rem', color: 'var(--accent-orange)', flexShrink: 0,
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>
            <strong>n8n not connected.</strong> Set <code>N8N_CHAT_URL</code> in <code>server/.env</code> to enable live chat.
          </span>
        </div>
      )}

      {/* Building status bar */}
      {building && (
        <div style={{
          background: 'rgba(96,165,250,.08)',
          border: '1px solid rgba(96,165,250,.2)',
          borderRadius: 'var(--radius-md)',
          padding: '0.625rem 1rem',
          margin: '0.75rem 1.5rem 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.8rem', color: 'var(--accent-blue)' }}>
            <span className="spinner" style={{ color: 'var(--accent-blue)', width: '14px', height: '14px', borderWidth: '2px' }} />
            <strong>Building…</strong>
            <span style={{ color: 'var(--text-secondary)' }}>
              {builds.length} page{builds.length !== 1 ? 's' : ''} generated so far
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/preview')}>
              <Eye size={12} /> Preview
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
              <LayoutDashboard size={12} /> Overview
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {messages.map(m => (
          <ChatBubble key={m.id} message={m} navigate={navigate} />
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
            <Avatar isUser={false} />
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '0 12px 12px 12px',
              padding: '0.75rem 1rem',
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

        <div ref={bottomRef} />
      </div>

      {/* Starter prompts — only on first message */}
      {messages.length === 1 && !loading && (
        <div style={{ padding: '0 1.5rem', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>
            Quick start
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {STARTER_PROMPTS.map((p, i) => (
              <button
                key={i}
                className="btn btn-ghost btn-sm"
                style={{ textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.4, padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                onClick={() => send(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

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

// ── Avatar ────────────────────────────────────────────────────────────────────
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

// ── ChatBubble ────────────────────────────────────────────────────────────────
function ChatBubble({ message, navigate }: { message: Message; navigate: ReturnType<typeof useNavigate> }) {
  const isUser = message.role === 'user';

  // ── Build complete card ──
  if (message.role === 'complete') {
    const { pageCount = 0, projectName = 'your project' } = message.meta ?? {};
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        {/* Green header strip */}
        <div style={{
          background: 'rgba(45,212,191,0.1)',
          borderBottom: '1px solid rgba(45,212,191,0.2)',
          padding: '0.875rem 1.125rem',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <CheckCircle2 size={18} color="var(--accent-teal)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Build complete!
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
              {pageCount} page{pageCount !== 1 ? 's' : ''} generated for <strong>{projectName}</strong>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1rem 1.125rem' }}>
          <p style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.65 }}>
            Your project is ready. You can now preview the generated pages, review them in the Overview dashboard, or commit the code directly to GitHub.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ justifyContent: 'center' }}
              onClick={() => navigate('/preview')}
            >
              <Eye size={13} /> Live Preview
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: 'center' }}
              onClick={() => navigate('/')}
            >
              <LayoutDashboard size={13} /> Overview
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: 'center' }}
              onClick={() => navigate('/github')}
            >
              <Github size={13} /> GitHub
            </button>
          </div>

          <div style={{
            marginTop: '0.875rem',
            padding: '0.625rem 0.875rem',
            background: 'var(--bg-base)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: '0.775rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            Want to build another project?{' '}
            <span
              style={{ color: 'var(--accent-teal)', cursor: 'pointer', fontWeight: 500 }}
              onClick={() => navigate('/chat')}
            >
              Start a new chat
            </span>
            {' '}or ask a follow-up question below to refine this project.
          </div>
        </div>
      </div>
    );
  }

  // ── System message ──
  if (message.role === 'system') {
    const isError   = message.text.startsWith('❌');
    const isSuccess = message.text.startsWith('✅') || message.text.startsWith('🚀');

    const bg     = isError   ? 'rgba(248,113,113,0.08)'  : isSuccess ? 'rgba(45,212,191,0.07)'  : 'rgba(96,165,250,0.07)';
    const border = isError   ? 'rgba(248,113,113,0.22)'  : isSuccess ? 'rgba(45,212,191,0.2)'   : 'rgba(96,165,250,0.18)';
    const color  = isError   ? 'var(--accent-red)'       : isSuccess ? 'var(--accent-teal)'     : 'var(--accent-blue)';

    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        padding: '0.5rem 0.875rem',
        background: bg, border: `1px solid ${border}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.8125rem', color: 'var(--text-secondary)',
        lineHeight: 1.6,
      }}>
        <span style={{ color, flexShrink: 0, marginTop: '2px', fontWeight: 700, fontSize: '0.875rem' }}>
          {isError ? '✕' : isSuccess ? '✓' : <Zap size={12} />}
        </span>
        <span dangerouslySetInnerHTML={{ __html: message.text
          .replace(/^[❌✅🚀]\s*/, '')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        }} />
      </div>
    );
  }

  // ── User / assistant bubble ──
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <Avatar isUser={isUser} />
      <div style={{
        maxWidth: '76%',
        background: isUser ? 'var(--accent-blue)' : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border)',
        borderRadius: isUser ? '12px 0 12px 12px' : '0 12px 12px 12px',
        padding: '0.75rem 1rem',
        fontSize: '0.875rem',
        color: isUser ? '#fff' : 'var(--text-primary)',
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.text}
      </div>
    </div>
  );
}
