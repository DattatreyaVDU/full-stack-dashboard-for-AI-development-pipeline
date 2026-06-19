import { useState, useRef } from 'react';
import { RefreshCw, ExternalLink, Monitor, Smartphone, Tablet } from 'lucide-react';

interface Props {
  url?: string;
  htmlContent?: string;
}

type ViewMode = 'desktop' | 'tablet' | 'mobile';

const viewWidths: Record<ViewMode, string> = {
  desktop: '100%',
  tablet:  '768px',
  mobile:  '390px',
};

export default function LivePreview({ url, htmlContent }: Props) {
  const [mode, setMode] = useState<ViewMode>('desktop');
  const [currentUrl, setCurrentUrl] = useState(url || '');
  const [inputUrl, setInputUrl] = useState(url || '');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const goToUrl = () => {
    setCurrentUrl(inputUrl);
  };

  const isEmpty = !currentUrl && !htmlContent;

  return (
    <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-sidebar)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Browser chrome */}
      <div className="preview-toolbar">
        <div className="preview-dots">
          <span style={{ background: '#ff5f57' }} />
          <span style={{ background: '#febc2e' }} />
          <span style={{ background: '#28c840' }} />
        </div>

        {/* URL bar */}
        <input
          className="preview-url-bar"
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && goToUrl()}
          placeholder="Enter URL to preview or paste HTML..."
        />

        {/* Viewport toggles */}
        <div className="flex gap-1" style={{ marginLeft: '0.25rem' }}>
          {(['desktop', 'tablet', 'mobile'] as ViewMode[]).map(m => {
            const Icon = m === 'desktop' ? Monitor : m === 'tablet' ? Tablet : Smartphone;
            return (
              <button
                key={m}
                className={`btn btn-ghost btn-sm btn-icon ${mode === m ? 'active' : ''}`}
                style={mode === m ? { background: 'rgba(59,130,246,.15)', color: 'var(--accent-blue)' } : {}}
                onClick={() => setMode(m)}
                title={m}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>

        <button className="btn btn-ghost btn-sm btn-icon" onClick={refresh} title="Refresh">
          <RefreshCw size={13} />
        </button>
        {currentUrl && (
          <a href={currentUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon" title="Open in new tab">
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Frame container */}
      <div style={{
        background: '#1a1a2e',
        display: 'flex',
        justifyContent: 'center',
        padding: mode !== 'desktop' ? '1rem' : '0',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          width: viewWidths[mode],
          maxWidth: '100%',
          transition: 'width 0.3s ease',
          background: '#fff',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {isEmpty ? (
            <div className="empty-state" style={{ flex: 1, background: 'var(--bg-base)' }}>
              <Monitor size={40} className="empty-state-icon" />
              <div className="empty-state-title">No preview yet</div>
              <div className="empty-state-text">
                Enter a URL above, or wait for n8n to send<br />generated code via webhook.
              </div>
            </div>
          ) : htmlContent ? (
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              sandbox="allow-scripts allow-same-origin"
              style={{ width: '100%', flex: 1, border: 'none', minHeight: 0 }}
              title="Live preview"
            />
          ) : (
            <iframe
              ref={iframeRef}
              src={currentUrl}
              style={{ width: '100%', flex: 1, border: 'none', minHeight: 0 }}
              title="Live preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
