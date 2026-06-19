import { Check, Loader2, AlertCircle, Circle, GitBranch, Webhook, Code2, Github, Layers, Rocket, LucideIcon } from 'lucide-react';
import { Pipeline, PipelineStatus } from '../../types';

const STEPS: Array<{ key: keyof Pipeline; label: string; Icon: LucideIcon }> = [
  { key: 'n8n',       label: 'n8n Build',  Icon: Code2 },
  { key: 'webhook',   label: 'Webhook',    Icon: Webhook },
  { key: 'github',    label: 'GitHub',     Icon: Github },
  { key: 'vscode',    label: 'VS Code',    Icon: GitBranch },
  { key: 'wordpress', label: 'WP Convert', Icon: Layers },
  { key: 'deploy',    label: 'Deploy',     Icon: Rocket },
];

function StatusIcon({ status }: { status: PipelineStatus }) {
  if (status === 'done')    return <Check size={15} color="var(--accent-teal)" />;
  if (status === 'running') return <Loader2 size={15} color="var(--accent-blue)" style={{ animation: 'spin 0.65s linear infinite' }} />;
  if (status === 'error')   return <AlertCircle size={15} color="var(--accent-red)" />;
  return <Circle size={13} color="var(--text-muted)" />;
}

interface Props { pipeline: Pipeline; }

export default function PipelineTracker({ pipeline }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <Code2 size={13} />
          Pipeline Status
        </span>
      </div>
      <div className="pipeline">
        {STEPS.map(({ key, label }) => (
          <div key={key} className={`pipeline-step ${pipeline[key]}`}>
            <div className="step-dot">
              <StatusIcon status={pipeline[key]} />
            </div>
            <div className="step-label">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
