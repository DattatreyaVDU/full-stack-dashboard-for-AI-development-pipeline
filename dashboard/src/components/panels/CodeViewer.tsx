import { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Copy, Check, FileCode2 } from 'lucide-react';

interface Props {
  content: string;
  language?: string;
  fileName?: string;
  maxHeight?: string;
}

export default function CodeViewer({ content, language = 'markdown', fileName, maxHeight = '480px' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = content.split('\n').length;

  return (
    <div className="code-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="code-panel-header" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <FileCode2 size={13} color="var(--text-muted)" />
          {fileName && (
            <span className="text-xs font-mono text-secondary truncate" style={{ maxWidth: '260px' }}>
              {fileName}
            </span>
          )}
          <span className="code-lang-badge">{language}</span>
          <span className="text-xs text-muted">{lineCount} lines</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="code-scroll" style={{ maxHeight, flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto' }}>
        <SyntaxHighlighter
          language={language}
          style={atomOneDark}
          showLineNumbers
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.775rem',
            lineHeight: '1.65',
          }}
          lineNumberStyle={{ color: '#3d5080', minWidth: '2.5em' }}
        >
          {content || '// No content yet. Waiting for n8n webhook...'}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
