import { CheckCircle2, FileEdit, PlayCircle } from 'lucide-react';
import type { QuizStatus } from '../../types/dashboard';

interface QuizStatusLabelProps {
  status: QuizStatus;
  compact?: boolean;
}

const STATUS_CONFIG: Record<QuizStatus, { label: string; className: string }> = {
  completed: {
    label: 'مكتملة',
    className: 'text-success-ink',
  },
  ready: {
    label: 'جاهزة للتشغيل',
    className: 'text-accent',
  },
  draft: {
    label: 'مسودة',
    className: 'text-warning-ink',
  },
};

export function QuizStatusLabel({ status, compact = false }: QuizStatusLabelProps) {
  const config = STATUS_CONFIG[status];
  const Icon =
    status === 'completed'
      ? CheckCircle2
      : status === 'ready'
        ? PlayCircle
        : FileEdit;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${config.className}`}>
      <Icon className={compact ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} />
      <span>{config.label}</span>
    </span>
  );
}
