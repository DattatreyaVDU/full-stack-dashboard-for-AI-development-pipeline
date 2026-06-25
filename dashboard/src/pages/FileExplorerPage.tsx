import { useState, useEffect } from 'react';
import { FolderOpen, Folder, FileCode, FileText, File, ChevronRight, ChevronDown, Download, Copy, Check, RefreshCw } from 'lucide-react';
import { DiskProject, FileTreeNode } from '../types';

const SERVER = (typeof window !== 'undefined' && (window as any).__SERVER_URL__) || '';

function langFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.php': 'php', '.css': 'css', '.js': 'javascript', '.ts': 'typescript',
    '.tsx': 'tsx', '.jsx': 'jsx', '.html': 'html', '.json': 'json',
    '.md': 'markdown', '.sql': 'sql', '.txt': 'text',
  };
  return map[ext] ?? 'text';
}

function fileIcon(node: FileTreeNode) {
  if (node.type === 'dir') return null;
  const ext = node.ext ?? '';
  if (['.php', '.ts', '.tsx', '.jsx'].includes(ext)) return <FileCode size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />;
  if (ext === '.css') return <FileCode size={12} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />;
  if (ext === '.js')  return <FileCode size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />;
  if (ext === '.json') return <FileText size={12} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />;
  if (ext === '.md')  return <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
  return <File size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface TreeNodeProps {
  node: FileTreeNode;
  depth?: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}

function TreeNode({ node, depth = 0, selectedPath, onSelect }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const isDir      = node.type === 'dir';
  const isSelected = !isDir && node.path === selectedPath;

  return (
    <div>
      <div
        onClick={() => isDir ? setOpen(!open) : onSelect(node.path)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: `0.2rem 0.5rem 0.2rem ${0.5 + depth * 1}rem`,
          cursor: 'pointer',
          background: isSelected ? 'rgba(96,165,250,0.12)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
          borderRadius: '0 4px 4px 0',
          fontSize: '0.78rem',
          color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
          userSelect: 'none',
        }}
      >
        {isDir ? (
          <>
            {open
              ? <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
              : <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
            }
            {open
              ? <FolderOpen size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
              : <Folder     size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
            }
          </>
        ) : (
          <>
            <span style={{ width: 11, flexShrink: 0 }} />
            {fileIcon(node)}
          </>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name}
        </span>
        {node.type === 'file' && node.size !== undefined && (
          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            {formatSize(node.size)}
          </span>
        )}
      </div>
      {isDir && open && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorerPage() {
  const [projects, setProjects]         = useState<DiskProject[]>([]);
  const [activeProject, setActiveProject] = useState('');
  const [tree, setTree]                 = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [fileContent, setFileContent]   = useState('');
  const [fileExt, setFileExt]           = useState('');
  const [loading, setLoading]           = useState(false);
  const [loadingFile, setLoadingFile]   = useState(false);
  const [copied, setCopied]             = useState(false);
  const [loadError, setLoadError]       = useState('');

  const authHeaders = () => {
    const token = localStorage.getItem('n8n-auth-token') ?? '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    setLoadError('');
    fetch(`${SERVER}/api/projects`, { headers: authHeaders() })
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then(d => {
        setProjects(d.projects || []);
        if (d.projects?.length > 0) setActiveProject(d.projects[0].name);
      })
      .catch(err => setLoadError(err.message ?? 'Failed to load projects'));
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    setSelectedFile('');
    setFileContent('');
    fetch(`${SERVER}/api/projects/${encodeURIComponent(activeProject)}/tree`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setTree(d.tree || []))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [activeProject]);

  const openFile = (relPath: string) => {
    setSelectedFile(relPath);
    setFileContent('');
    setLoadingFile(true);
    fetch(`${SERVER}/api/projects/${encodeURIComponent(activeProject)}/file?path=${encodeURIComponent(relPath)}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        setFileContent(d.content ?? '');
        setFileExt(d.ext ?? '');
      })
      .catch(() => setFileContent('// Could not load file'))
      .finally(() => setLoadingFile(false));
  };

  const copyFile = () => {
    navigator.clipboard.writeText(fileContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadFile = () => {
    if (!fileContent) return;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = selectedFile.split('/').pop() ?? 'file';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [downloadingZip, setDownloadingZip] = useState(false);

  const downloadZip = async () => {
    if (!activeProject || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const token = localStorage.getItem('n8n-auth-token') ?? '';
      const res   = await fetch(`${SERVER}/api/download?project=${encodeURIComponent(activeProject)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { alert('Download failed — project files not found on server.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${activeProject}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed — check your connection.'); }
    finally { setDownloadingZip(false); }
  };

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0' }}>

      {/* ── Load error banner ── */}
      {loadError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.625rem 1rem', marginBottom: '0.75rem',
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--accent-red)',
        }}>
          Could not load projects: {loadError}
        </div>
      )}

      {/* ── Project selector bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.625rem 1rem', marginBottom: '0.75rem',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', flexWrap: 'wrap',
      }}>
        <FolderOpen size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        <select
          value={activeProject}
          onChange={e => setActiveProject(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '0.35rem 0.6rem',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
          }}
        >
          {projects.length === 0
            ? <option value="">No projects found</option>
            : projects.map(p => <option key={p.name} value={p.name}>{p.name} ({p.fileCount} files)</option>)
          }
        </select>

        <button
          onClick={() => {
            setLoading(true);
            fetch(`${SERVER}/api/projects/${encodeURIComponent(activeProject)}/tree`, { headers: authHeaders() })
              .then(r => r.json()).then(d => setTree(d.tree || []))
              .finally(() => setLoading(false));
          }}
          style={{
            display: 'flex', alignItems: 'center', padding: '0.35rem',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>

        {activeProject && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {projects.find(p => p.name === activeProject)?.totalSizeFmt}
          </span>
        )}

        {activeProject && (
          <button
            onClick={downloadZip}
            disabled={downloadingZip}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.3rem 0.7rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(0,201,167,0.3)',
              background: 'rgba(0,201,167,0.08)',
              color: 'var(--accent-teal)',
              fontSize: '0.75rem', fontWeight: 600,
              cursor: downloadingZip ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: downloadingZip ? 0.6 : 1,
            }}
          >
            <Download size={12} /> {downloadingZip ? 'Preparing…' : 'Download ZIP'}
          </button>
        )}
      </div>

      {/* ── Main pane ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '0.75rem', flex: 1, minHeight: 0 }}>

        {/* File tree */}
        <div className="card" style={{ overflow: 'auto', padding: '0.5rem 0' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Loading…
            </div>
          ) : tree.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {activeProject ? 'Empty project' : 'Select a project'}
            </div>
          ) : (
            tree.map(node => (
              <TreeNode key={node.path} node={node} selectedPath={selectedFile} onSelect={openFile} />
            ))
          )}
        </div>

        {/* File viewer */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          {/* Viewer header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.55rem 0.875rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile || 'No file selected'}
            </span>
            {selectedFile && (
              <>
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {langFromExt(fileExt)}
                </span>
                <button onClick={copyFile} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  {copied ? <><Check size={11} color="var(--accent-teal)" /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
                <button onClick={downloadFile} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  <Download size={11} /> Download
                </button>
              </>
            )}
          </div>

          {/* Code area */}
          <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
            {loadingFile ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Loading file…
              </div>
            ) : fileContent ? (
              <pre style={{
                margin: 0, padding: '1rem',
                fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                tabSize: 2,
              }}>
                {fileContent}
              </pre>
            ) : (
              <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileCode size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <div style={{ fontSize: '0.8rem' }}>Select a file from the tree to view its contents</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
