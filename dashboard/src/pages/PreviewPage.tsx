import { useState, useEffect } from 'react';
import { Eye, Code2, SplitSquareHorizontal, FileText, FolderOpen, Zap } from 'lucide-react';
import LivePreview from '../components/panels/LivePreview';
import CodeViewer from '../components/panels/CodeViewer';
import { Build } from '../types';

interface Props { latestBuild: Build | null; builds: Build[]; }

type ViewMode = 'preview' | 'code' | 'split';

export default function PreviewPage({ latestBuild, builds }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('split');

  useEffect(() => {
    if (latestBuild) setSelectedId(latestBuild.id);
  }, [latestBuild?.id]);

  const build = builds.find(b => b.id === selectedId) ?? latestBuild;

  return (
    <div className="page-body">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-4" style={{ gap: '1rem' }}>
        <div className="flex gap-2 items-center" style={{ flex: 1 }}>
          {builds.length > 0 ? (
            <select
              value={selectedId ?? ''}
              onChange={e => setSelectedId(e.target.value)}
              style={{ minWidth: '280px', maxWidth: '520px' }}
            >
              <option value="">— Select build —</option>
              {builds.map(b => (
                <option key={b.id} value={b.id}>
                  [{b.pageId}] {b.projectName} / {b.pageName}
                  {b.content ? '' : ' ⚠ no content'}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No builds yet — run your n8n workflow to generate pages
            </span>
          )}
        </div>

        <div className="flex gap-1">
          {([
            { id: 'preview', Icon: Eye,                   label: 'Preview' },
            { id: 'code',    Icon: Code2,                 label: 'Code'    },
            { id: 'split',   Icon: SplitSquareHorizontal, label: 'Split'   },
          ] as const).map(({ id, Icon, label }) => (
            <button
              key={id}
              className={`btn btn-ghost btn-sm ${view === id ? 'active' : ''}`}
              style={view === id ? { background: 'rgba(13,148,136,0.1)', color: 'var(--accent-teal)', borderColor: 'rgba(13,148,136,0.2)' } : {}}
              onClick={() => setView(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {build ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: view === 'split' ? '1fr 1fr' : '1fr',
          gap: '1.25rem',
          height: 'calc(100vh - 195px)',
          overflow: 'hidden',
        }}>
          {/* ── Live Preview ── */}
          {view !== 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              <div className="card-title" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                <Eye size={12} /> Live Preview
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {getPreviewHtml(build.content) ? (
                  <LivePreview
                    htmlContent={getPreviewHtml(build.content)!}
                    url={undefined}
                  />
                ) : extractUrl(build.content) ? (
                  <LivePreview
                    htmlContent={undefined}
                    url={extractUrl(build.content)}
                  />
                ) : (
                  <BuildMetaCard build={build} />
                )}
              </div>
            </div>
          )}

          {/* ── Code Panel ── */}
          {view !== 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              <div className="card-title" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                <Code2 size={12} /> Generated Content
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
        <div className="empty-state card" style={{ padding: '4rem' }}>
          <Eye size={40} className="empty-state-icon" />
          <div className="empty-state-title">No build selected</div>
          <div className="empty-state-text">
            Trigger your n8n workflow or select a build from the dropdown.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shown when content field is empty ────────────────────────────────────────
function BuildMetaCard({ build }: { build: Build }) {
  return (
    <div className="card" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1.25rem',
        paddingBottom: '0.875rem',
        borderBottom: '1px solid var(--border)',
      }}>
        <Zap size={14} style={{ color: 'var(--accent-teal)' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Build received — no HTML content
        </span>
      </div>

      <MetaRow icon={<FileText size={13} />} label="Project" value={build.projectName} />
      <MetaRow icon={<FileText size={13} />} label="Page"    value={build.pageName} />
      <MetaRow icon={<FolderOpen size={13} />} label="Folder" value={build.folder || build.filePath || '—'} />
      {build.generatedFiles && build.generatedFiles.length > 0 && (
        <MetaRow icon={<FileText size={13} />} label="Files" value={build.generatedFiles.join(', ')} />
      )}

      <div style={{
        marginTop: '1.25rem',
        padding: '0.875rem 1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(234,88,12,0.06)',
        border: '1px solid rgba(234,88,12,0.18)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--accent-orange)' }}>Content not received.</strong>
        {' '}In n8n, make sure your HTTP Request node sends a <code>content</code> field
        containing the generated HTML. Check the Code panel for the expected JSON body.
      </div>
    </div>
  );
}

// ── Shown in code panel when content is empty ─────────────────────────────────
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
        fontSize: '0.75rem', fontWeight: 700,
        color: 'var(--accent-orange)',
        marginBottom: '0.875rem',
        letterSpacing: '0.01em',
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
        marginTop: '1.125rem',
        paddingTop: '0.875rem',
        borderTop: '1px solid var(--border)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        lineHeight: 1.7,
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
      display: 'flex', gap: '0.625rem',
      alignItems: 'flex-start',
      marginBottom: '0.5rem',
      fontSize: '0.8rem',
    }}>
      <span style={{ color: 'var(--text-muted)', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'var(--text-muted)', minWidth: '56px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  );
}

// ── Content detection ──────────────────────────────────────────────────────────

function getPreviewHtml(content: string | undefined): string | undefined {
  if (!content) return undefined;

  // 1. Markdown fenced HTML block: ```html ... ```
  const fenced = content.match(/```(?:html|HTML)\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // 2. Raw HTML document
  const trimmed = content.trim();
  if (
    /^<!DOCTYPE\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed)
  ) return trimmed;

  // 3. Has enough HTML structure to be a page fragment
  if (
    trimmed.includes('<body') &&
    trimmed.includes('</body>') &&
    (trimmed.includes('<div') || trimmed.includes('<section'))
  ) return trimmed;

  // 4. Has a substantial amount of HTML tags — wrap in a page shell
  const tagCount = (trimmed.match(/<[a-z][^>]*>/gi) ?? []).length;
  if (tagCount >= 5) {
    return wrapFragment(trimmed);
  }

  // 5. Plain text / markdown — wrap so it displays nicely in the iframe
  if (trimmed.length > 20) {
    return wrapTextContent(trimmed);
  }

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
  // Basic markdown → HTML for headers and bold
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
