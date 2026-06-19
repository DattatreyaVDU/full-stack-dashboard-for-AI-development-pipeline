import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent: 'teal' | 'blue' | 'purple' | 'orange';
  Icon: LucideIcon;
}

export default function StatCard({ label, value, sub, accent, Icon }: Props) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className="stat-icon">
        <Icon size={52} />
      </div>
    </div>
  );
}
