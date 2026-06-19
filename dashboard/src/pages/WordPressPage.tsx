import React, { useState } from 'react';
import { Layers, Download, Package, Rocket, CheckCircle, FileCode, Globe, FolderOpen, File } from 'lucide-react';
import { wordpress as wpApi } from '../api/client';
import { useAuth } from '../store/useAuth';
import { Build } from '../types';
import { useToast } from '../components/cards/ToastProvider';
import DeployModal from '../components/panels/DeployModal';

interface Props {
  latestBuild: Build | null;
  builds: Build[];
  onPipelineStep: (step: string, status: string) => void;
}

// Map file extensions to display colors
function fileColor(filename: string): string {
  if (filename.endsWith('.css'))  return 'var(--accent-blue)';
  if (filename.endsWith('.php'))  return '#a78bfa';
  if (filename.endsWith('.js'))   return '#fbbf24';
  return 'var(--text-secondary)';
}

export default function WordPressPage({ latestBuild, builds, onPipelineStep }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [converting, setConverting] = useState(false);
  const [zipBlob, setZipBlob]       = useState<Blob | null>(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');

  // Unique project names from all builds
  const projects = [...new Set(builds.map(b => b.projectName).filter(Boolean))];
  const activeProject = selectedProject || latestBuild?.projectName || '';
  const themeName = activeProject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const pagesInProject = builds.filter(b => b.projectName === activeProject);

  // Collect all written files from builds (files_written field from WP File Creation node)
  const allFilesWritten: string[] = [];
  for (const b of pagesInProject) {
    const fw = (b as any).files_written as string[] | undefined;
    if (fw?.length) {
      allFilesWritten.push(...fw);
    } else if (b.pageName) {
      // fallback: use pageName (file path) — extract just the filename
      const parts = b.pageName.replace(/\\/g, '/').split('/');
      allFilesWritten.push(parts[parts.length - 1]);
    }
  }
  const uniqueFiles = [...new Set(allFilesWritten)];

  const handleConvert = async () => {
    if (!activeProject) return;
    setConverting(true);
    setZipBlob(null);
    onPipelineStep('wordpress', 'running');
    try {
      const pages = pagesInProject.map(b => ({
        id:          b.pageId,
        name:        b.pageName,
        description: b.content?.slice(0, 500) ?? '',
      }));
      const blob = await wpApi.convert({
        projectName: activeProject,
        pages,
        globalContext: latestBuild?.rawPayload?.global_context ?? {},
        githubRepo: user?.github?.selectedRepo ?? undefined,
      });
      setZipBlob(blob);
      onPipelineStep('wordpress', 'done');
      toast('WordPress theme packaged!', 'success', `${themeName}-wp-theme.zip ready`);
    } catch (e: unknown) {
      onPipelineStep('wordpress', 'error');
      toast(e instanceof Error ? e.message : 'Conversion failed', 'error');
    } finally {
      setConverting(false);
    }
  };

  const handleDownload = () => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const a   = document.createElement('a');
    a.href = url;
    a.download = `${themeName}-wp-theme.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const themeFiles = [
    { file: 'style.css',              desc: 'Theme header + all CSS variables' },
    { file: 'functions.php',          desc: 'Enqueue scripts, register menus, ACF' },
    { file: 'index.php',              desc: 'Main WordPress loop' },
    { file: 'header.php',             desc: 'Site header & navigation' },
    { file: 'footer.php',             desc: 'Site footer + cookie banner' },
    { file: 'page.php',               desc: 'Default page template' },
    { file: 'single.php',             desc: 'Single post template' },
    { file: 'archive.php',            desc: 'Archive / category template' },
    { file: '404.php',                desc: 'Not found page' },
    { file: 'search.php',             desc: 'Search results template' },
    { file: 'inc/cookie-banner.php',  desc: 'GDPR cookie consent banner' },
    { file: 'assets/js/main.js',      desc: 'IntersectionObserver + hamburger' },
    { file: 'page-[slug].php',        desc: `Feature page templates · ${pagesInProject.length > 0 ? pagesInProject.length - 2 : 0} pages` },
    { file: 'template-parts/[slug]/', desc: 'Auto-extracted section partials' },
  ];

  return (
    <div className="page-body">

      {/* ── Generated WordPress Files ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
          <FolderOpen size={14} color="#a78bfa" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Generated WordPress Files</span>
          {builds.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>{builds.length}</strong> file{builds.length !== 1 ? 's' : ''} received from n8n
              {latestBuild && <> · Last: <strong style={{ color: 'var(--text-secondary)' }}>{latestBuild.projectName}</strong> · {new Date(latestBuild.timestamp).toLocaleTimeString()}</>}
            </span>
          )}
        </div>

        {uniqueFiles.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {uniqueFiles.map(f => (
              <span key={f} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.6rem',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: '99px',
                fontSize: '0.72rem',
                color: fileColor(f),
                fontFamily: 'var(--font-mono)',
              }}>
                <File size={9} /> {f}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', textAlign: 'center' }}>
            No files yet — run your n8n workflow. Files will appear here as they are generated.
          </div>
        )}
      </div>

      {/* ── Project selector ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '220px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Project to Convert</label>
            <select
              value={selectedProject}
              onChange={e => { setSelectedProject(e.target.value); setZipBlob(null); }}
              className="w-full"
            >
              {latestBuild && <option value="">Latest — {latestBuild.projectName}</option>}
              {projects.map(p => (
                <option key={p} value={p}>{p} ({builds.filter(b => b.projectName === p).length} pages)</option>
              ))}
              {projects.length === 0 && <option value="" disabled>No builds yet</option>}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Theme slug</label>
            <code style={{
              padding: '0.45rem 0.75rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: 'var(--accent-teal)',
              fontFamily: 'var(--font-mono)',
            }}>
              {themeName || '—'}
            </code>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Pages</label>
            <span style={{
              padding: '0.45rem 0.875rem',
              background: 'rgba(0,201,167,.08)',
              border: '1px solid rgba(0,201,167,.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--accent-teal)',
            }}>
              {pagesInProject.length}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* ── Convert card ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Layers size={14} />One-Click WordPress Theme</span>
          </div>

          {/* Pages list */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="form-label">Pages included</div>
            {pagesInProject.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {pagesInProject.map(b => (
                  <span key={b.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0.6rem',
                    background: b.content ? 'rgba(0,201,167,.1)' : 'rgba(251,146,60,.1)',
                    border: `1px solid ${b.content ? 'rgba(0,201,167,.25)' : 'rgba(251,146,60,.25)'}`,
                    borderRadius: '99px',
                    fontSize: '0.73rem',
                    color: b.content ? 'var(--accent-teal)' : 'var(--accent-orange)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {b.content ? <CheckCircle size={10} /> : '⚠'} {b.pageId} {b.pageName}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                No builds for this project yet. Run your n8n workflow first.
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleConvert}
              disabled={converting || !activeProject || pagesInProject.length === 0}
              style={{ flex: 1 }}
            >
              {converting ? <span className="spinner" /> : <Package size={15} />}
              {converting ? 'Packaging theme…' : '⚡ Build & Download Theme'}
            </button>

            {zipBlob && (
              <button className="btn btn-blue btn-lg" onClick={handleDownload}>
                <Download size={15} /> Download ZIP
              </button>
            )}

            {zipBlob && (
              <button className="btn btn-danger btn-lg" onClick={() => setShowDeploy(true)}>
                <Rocket size={15} /> Deploy to EasyWP
              </button>
            )}
          </div>

          {zipBlob && (
            <div style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(0,201,167,.07)', border: '1px solid rgba(0,201,167,.2)',
              borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.625rem',
              fontSize: '0.8rem', color: 'var(--accent-teal)',
            }}>
              <CheckCircle size={14} />
              <span><strong>{themeName}-wp-theme.zip</strong> ready — install on WordPress or deploy via FTP</span>
            </div>
          )}
        </div>

        {/* ── Theme structure ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><FileCode size={13} />Theme File Structure</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {themeFiles.map(({ file, desc }) => (
              <div key={file} style={{
                display: 'grid', gridTemplateColumns: '160px 1fr',
                alignItems: 'center', gap: '0.75rem',
                padding: '0.45rem 0.625rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                fontSize: '0.8rem',
              }}>
                <code style={{ color: 'var(--accent-teal)', fontSize: '0.73rem', fontFamily: 'var(--font-mono)' }}>
                  {file}
                </code>
                <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Install guide ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--accent-blue)' }}>
            <Globe size={13} />Install on WordPress / EasyWP
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.625rem', color: 'var(--text-primary)' }}>
              Manual Upload
            </div>
            <ol style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
              <li>Click <strong>Build & Download Theme</strong> above</li>
              <li>Click <strong>Download ZIP</strong></li>
              <li>WordPress Admin → <strong>Appearance → Themes → Add New → Upload</strong></li>
              <li>Select <code>{themeName || 'theme'}-wp-theme.zip</code> → <strong>Install Now</strong></li>
              <li>Click <strong>Activate</strong> — done</li>
            </ol>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.625rem', color: 'var(--text-primary)' }}>
              Auto Deploy via FTP
            </div>
            <ol style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
              <li>Set <code>FTP_HOST</code>, <code>FTP_USER</code>, <code>FTP_PASS</code> in <code>server/.env</code></li>
              <li>Click <strong>Convert & Package</strong></li>
              <li>Click <strong>Deploy to EasyWP</strong></li>
              <li>Theme uploads automatically to <code>/wp-content/themes/</code></li>
            </ol>
          </div>
        </div>
      </div>

      {showDeploy && zipBlob && (
        <DeployModal
          onClose={() => setShowDeploy(false)}
          zipBlob={zipBlob}
          themeName={themeName}
        />
      )}
    </div>
  );
}
