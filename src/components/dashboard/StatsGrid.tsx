import { BookOpen, ClipboardCheck, Trophy, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { DashboardMetric } from '../../types/dashboard';

interface StatsGridProps {
  metrics: DashboardMetric[];
  isPreviewData?: boolean;
}

const METRIC_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'total-questions': BookOpen,
  'total-competitions': Trophy,
  'total-tests': ClipboardCheck,
  'total-students': Users,
};

const TONE_CLASSES: Record<DashboardMetric['accentTone'], string> = {
  indigo: 'border border-selected-line bg-selected text-accent',
  emerald: 'border border-success-line bg-success-soft text-success-ink',
  sky: 'border border-line bg-surface-subtle text-accent',
  amber: 'border border-warning-line bg-warning-soft text-warning-ink',
};

export function StatsGrid({ metrics }: StatsGridProps) {
  return (
    <section aria-label="الإحصائيات المختصرة">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold text-ink">
          نظرة سريعة على النشاط
        </h3>
        <span className="text-xs font-medium text-ink-muted">
          إحصائيات مباشرة من قاعدة البيانات المحلية
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.id] ?? BookOpen;
          return (
            <div
              key={metric.id}
              className="qc-card p-5 transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold text-ink-muted">{metric.label}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`font-display tabular-nums text-3xl font-extrabold tracking-tight ${
                        metric.hasError ? 'text-danger-ink' : 'text-ink'
                      }`}
                    >
                      {metric.value === null ? '—' : metric.value}
                    </span>
                    {metric.unitLabel && (
                      <span className="text-xs font-medium text-ink-muted">
                        {metric.unitLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    TONE_CLASSES[metric.accentTone]
                  }`}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <p
                className={`mt-3 text-xs ${
                  metric.hasError ? 'font-bold text-danger-ink' : 'text-ink-muted'
                }`}
              >
                {metric.detailText}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
