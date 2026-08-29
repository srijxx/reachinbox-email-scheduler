import type { EmailStatus } from '../../types';

interface StatusBadgeProps {
  status: EmailStatus | string;
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  scheduled: {
    label: 'Scheduled',
    classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  processing: {
    label: 'Processing',
    classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  },
  sent: {
    label: 'Sent',
    classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  };

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.classes,
      ].join(' ')}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
