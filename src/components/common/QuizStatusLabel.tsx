import { CheckCircle2, FileEdit, PlayCircle } from 'lucide-react';
import type { QuizStatus } from '../../types/dashboard';

interface QuizStatusLabelProps {
  status: QuizStatus;
  compact?: boolean;
}

const STATUS_CONFIG: Record<QuizStatus, { label: string; className: string }> = {
  completed: {
    label: 'مكتملة',
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  ready: {
    label: 'جاهزة للتشغيل',
    className: 'text-indigo-600 dark:text-indigo-400',
  },
  draft: {
    label: 'مسودة',
    className: 'text-amber-600 dark:text-amber-400',
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
