import { useState, useEffect } from 'react';
import {
  Eye, Code2, SplitSquareHorizontal, FileText, FolderOpen, Zap,
  Monitor, Tablet, Smartphone, CheckCircle2, Loader2, AlertCircle,
  ChevronDown,
} from 'lucide-react';
import LivePreview from '../components/panels/LivePreview';
import CodeViewer from '../components/panels/CodeViewer';
import { Build } from '../types';

interface Props { latestBuild: Build | null; builds: Build[]; }

function cleanName(path: string): string {
  if (!path) return '';
  return path.split(/[/\\]/).pop()?.replace(/\.md$/i, '') ?? path;
}

type ViewMode   = 'preview' | 'code' | 'split';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceMode, number | undefined> = {
  desktop: undefined,
  tablet:  768,
  mobile:  375,
};

const DEVICE_META: { id: DeviceMode; Icon: typeof Monitor; label: string }[] = [
  { id: 'desktop', Icon: Monitor,    label: 'Desktop' },
  { id: 'tablet',  Icon: Tablet,     label: 'Tablet'  },
  { id: 'mobile',  Icon: Smartphone, label: 'Mobile'  },
];

export default function PreviewPage({ latestBuild, builds }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view,       setView]       = useState<ViewMode>('split');
  const [device,     setDevice]     = useState<DeviceMode>('desktop');
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready'>('idle');

  useEffect(() => {
    if (latestBuild) { setSelectedId(latestBuild.id); setPreviewStatus('loading'); }
  }, [latestBuild?.id]);

  // Simulate preview loading state when selection changes
  useEffect(() => {
    if (!selectedId) { setPreviewStatus('idle'); return; }
    setPreviewStatus('loading');
    const t = setTimeout(() => setPreviewStatus('ready'), 600);
    return () => clearTimeout(t);
  }, [selectedId]);

  const build = builds.find(b => b.id === selectedId) ?? latestBuild;

  const statusDot = (
    previewStatus === 'ready'   ? { color: 'var(--accent-teal)',   Icon: CheckCircle2, label: 'Ready'   } :
    previewStatus === 'loading' ? { color: 'var(--accent-blue)',   Icon: Loader2,      label: 'Loading' } :
                                  { color: 'var(--text-muted)',    Icon: AlertCircle,  label: 'No build' }
  );

  const previewWidth = DEVICE_WIDTHS[device];

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        marginBottom: '0.875rem', flexShrink: 0,
      }}>

        {/* Build selector */}
        <div style={{
          flex: 1, minWidth: '220px', maxWidth: '520px',
          position: 'relative',
        }}>
          {builds.length > 0 ? (
            <>
              <select
                value={selectedId ?? ''}
                onChange={e => setSelectedId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 2rem 0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  appearance: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">— Select build —</option>
                {builds.map(b => (
                  <option key={b.id} value={b.id}>
                    [{b.pageId}] {cleanName(b.projectName)} › {cleanName(b.pageName)}
                    {b.content ? '' : ' ⚠ no content'}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} style={{
                position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
            </>
          ) : (
            <div style={{
              padding: '0.45rem 0.75rem',
              background: 'var(--bg-card)', border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <AlertCircle size={12} style={{ color: 'var(--accent-orange)' }} />
              No builds yet — run your n8n workflow to generate pages
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.375rem 0.75rem',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.72rem', fontWeight: 600,
          color: statusDot.color,
          flexShrink: 0,
        }}>
          <statusDot.Icon
            size={12}
            style={{ animation: previewStatus === 'loading' ? 'spin 1s linear infinite' : 'none' }}
          />
          {statusDot.label}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Device switcher — only shown when preview is active */}
        {view !== 'code' && build && (
          <div style={{
            display: 'flex', gap: '2px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '2px',
          }}>
            {DEVICE_META.map(({ id, Icon, label }) => (
              <button
                key={id}
                title={label}
                onClick={() => setDevice(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.6rem', border: 'none', cursor: 'pointer',
                  borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                  background: device === id
                    ? 'rgba(45,212,191,0.12)'
                    : 'transparent',
                  color: device === id ? 'var(--accent-teal)' : 'var(--text-muted)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon size={12} />
                <span style={{ display: id === 'desktop' ? undefined : 'none' }}
                      className="hide-sm">{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* View mode toggle */}
        <div style={{
          display: 'flex', gap: '2px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '2px',
        }}>
          {([
            { id: 'preview', Icon: Eye,                   label: 'Preview' },
            { id: 'code',    Icon: Code2,                 label: 'Code'    },
            { id: 'split',   Icon: SplitSquareHorizontal, label: 'Split'   },
          ] as const).map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.375rem 0.7rem', border: 'none', cursor: 'pointer',
                borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                background: view === id ? 'rgba(45,212,191,0.12)' : 'transparent',
                color: view === id ? 'var(--accent-teal)' : 'var(--text-muted)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      {build ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: view === 'split' ? '1fr 1fr' : '1fr',
          gap: '1rem',
          flex: 1, minHeight: 0, overflow: 'hidden',
        }}>

          {/* ── Live Preview panel ── */}
          {view !== 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.425rem 0.75rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', flexShrink: 0,
              }}>
                <Eye size={12} style={{ color: 'var(--accent-teal)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Prompt Preview
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-orange)', marginLeft: '0.25rem' }}>
                  rendered markdown — paste into Cursor to build
                </span>
                {previewWidth && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {previewWidth}px
                  </span>
                )}
              </div>

              {/* Preview frame */}
              <div style={{
                flex: 1, minHeight: 0, overflow: 'hidden',
                display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                background: device !== 'desktop' ? 'var(--bg-base)' : 'transparent',
                borderRadius: device !== 'desktop' ? 'var(--radius-md)' : 0,
                padding: device !== 'desktop' ? '0.75rem' : 0,
              }}>
                <div style={{
                  width: previewWidth ? `${previewWidth}px` : '100%',
                  height: '100%',
                  transition: 'opacity 0.3s ease, width 0.3s ease',
                  boxShadow: previewWidth ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
                  borderRadius: previewWidth ? '8px' : 0,
                  overflow: 'hidden',
                  opacity: previewStatus === 'loading' ? 0.6 : 1,
                  position: 'relative',
                }}>
                  {previewStatus === 'loading' && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.4)', borderRadius: previewWidth ? '8px' : 0,
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Loader2 size={24} style={{ color: 'var(--accent-teal)', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rendering preview…</span>
                      </div>
                    </div>
                  )}
                  {getPreviewHtml(build.content) ? (
                    <LivePreview htmlContent={getPreviewHtml(build.content)!} url={undefined} />
                  ) : extractUrl(build.content) ? (
                    <LivePreview htmlContent={undefined} url={extractUrl(build.content)} />
                  ) : (
                    <BuildMetaCard build={build} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Code panel ── */}
          {view !== 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.425rem 0.75rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', flexShrink: 0,
              }}>
                <Code2 size={12} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Generated Content
                </span>
                {build.pageName && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: 180,
                  }}>
                    {cleanName(build.pageName)}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {build.content ? (
                  <CodeViewer
                    content={build.content}
                    language={detectLanguage(build.content, build.pageName)}
                    fileName={build.filePath || `${build.pageId}_${build.pageName}`}
                    maxHeight="100%"
                  />
                ) : (
                  <NoContentCard build={build} />
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            textAlign: 'center', padding: '3rem',
            background: 'var(--bg-card)', border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg, 14px)', maxWidth: 400,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '16px', margin: '0 auto 1.25rem',
              background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Eye size={24} style={{ color: 'var(--accent-teal)', opacity: 0.6 }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              No build selected
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
              Trigger your n8n workflow or select a build from the dropdown above to preview the generated content.
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Build meta card (no HTML content) ─────────────────────────────────────────

function BuildMetaCard({ build }: { build: Build }) {
  return (
    <div className="card" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1.25rem', paddingBottom: '0.875rem',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '8px',
          background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={14} style={{ color: 'var(--accent-teal)' }} />
        </div>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Build received — no HTML content
        </span>
      </div>

      <MetaRow icon={<FileText size={13} />}  label="Project" value={build.projectName} />
      <MetaRow icon={<FileText size={13} />}  label="Page"    value={build.pageName} />
      <MetaRow icon={<FolderOpen size={13} />} label="Folder" value={build.folder || build.filePath || '—'} />
      {build.generatedFiles && build.generatedFiles.length > 0 && (
        <MetaRow icon={<FileText size={13} />} label="Files" value={build.generatedFiles.join(', ')} />
      )}

      <div style={{
        marginTop: '1.25rem', padding: '0.875rem 1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.18)',
        fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--accent-orange)' }}>Content not received.</strong>
        {' '}In n8n, make sure your HTTP Request node sends a <code>content</code> field
        containing the generated HTML. Check the Code panel for the expected JSON body.
      </div>
    </div>
  );
}

// ── No-content code panel ─────────────────────────────────────────────────────

function NoContentCard({ build }: { build: Build }) {
  const snippet = `{
  "projectName":   "{{ $json.project_name || $json.carpeta }}",
  "pageName":      "{{ $json.page_name || $json.archivo_creado }}",
  "pageId":        "{{ $json.page_id || '01' }}",
  "content":       "{{ $json.content || $json.output }}",
  "projectFolder": "{{ $json.carpeta }}",
  "status":        "completed",
  "timestamp":     "{{ $now.toISO() }}"
}`;

  return (
    <div className="card code-panel" style={{ padding: '1.25rem', height: '100%', overflowY: 'auto' }}>
      <div style={{
        fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-orange)',
        marginBottom: '0.875rem', letterSpacing: '0.01em',
      }}>
        No content — add this to your n8n HTTP Request body
      </div>
      <pre style={{
        fontSize: '0.775rem', lineHeight: 1.75,
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {snippet}
      </pre>
      <div style={{
        marginTop: '1.125rem', paddingTop: '0.875rem',
        borderTop: '1px solid var(--border)',
        fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.7,
      }}>
        <div>Build: <strong style={{ color: 'var(--text-secondary)' }}>{build.projectName} / {build.pageName}</strong></div>
        <div>Received: {new Date(build.timestamp).toLocaleString()}</div>
        <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          Tip: In n8n HTTP Request node, use <em>Using Fields Below</em> mode and click ⚡ on each value to enable expressions.
        </div>
      </div>
    </div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
      marginBottom: '0.5rem', fontSize: '0.8rem',
    }}>
      <span style={{ color: 'var(--text-muted)', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'var(--text-muted)', minWidth: '56px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  );
}

// ── Content detection helpers (unchanged) ─────────────────────────────────────

function getPreviewHtml(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const fenced = content.match(/```(?:html|HTML)\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const trimmed = content.trim();
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return trimmed;
  if (trimmed.includes('<body') && trimmed.includes('</body>') && (trimmed.includes('<div') || trimmed.includes('<section'))) return trimmed;
  const tagCount = (trimmed.match(/<[a-z][^>]*>/gi) ?? []).length;
  if (tagCount >= 5) return wrapFragment(trimmed);
  if (trimmed.length > 20) return wrapTextContent(trimmed);
  return undefined;
}

function wrapFragment(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

function wrapTextContent(text: string): string {
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 820px; margin: 2rem auto; padding: 0 1.5rem;
      line-height: 1.75; color: #1e293b; font-size: 15px;
    }
    h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin: 1.5rem 0 0.75rem; }
    h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 1.25rem 0 0.5rem; }
    h3 { font-size: 1.05rem; font-weight: 600; color: #334155; margin: 1rem 0 0.4rem; }
    p  { margin: 0.75rem 0; }
    ul { padding-left: 1.5rem; margin: 0.5rem 0; }
    li { margin-bottom: 0.35rem; }
    code { background: #f1f5f9; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.875em; font-family: monospace; }
    strong { color: #0f172a; }
    .badge {
      display: inline-block; background: #0d9488; color: #fff;
      font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.55rem;
      border-radius: 999px; letter-spacing: 0.03em; margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="badge">Build Plan</div>
  <p>${html}</p>
</body>
</html>`;
}

function extractUrl(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const match = content.match(/https?:\/\/[^\s)"']+/);
  return match ? match[0] : undefined;
}

function detectLanguage(content: string | undefined, pageName: string): string {
  if (content) {
    const t = content.trim();
    if (/^<!DOCTYPE\s+html/i.test(t) || /^<html/i.test(t)) return 'html';
    if (t.includes('```html')) return 'html';
    if (t.includes('```css'))  return 'css';
    if (t.includes('```js') || t.includes('```javascript')) return 'javascript';
    if (t.includes('CREATE TABLE') || t.includes('SELECT ')) return 'sql';
  }
  if (!pageName) return 'markdown';
  const p = pageName.toLowerCase();
  if (p.endsWith('.html') || p.includes('html')) return 'html';
  if (p.endsWith('.ts')   || p.includes('typescript')) return 'typescript';
  if (p.endsWith('.js'))   return 'javascript';
  if (p.endsWith('.sql')  || p.includes('schema')) return 'sql';
  if (p.endsWith('.css'))  return 'css';
  return 'markdown';
}
