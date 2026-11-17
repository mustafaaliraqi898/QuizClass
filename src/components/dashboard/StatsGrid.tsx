import { BookOpen, ClipboardCheck, Trophy, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { DashboardMetric } from '../../types/dashboard';

interface StatsGridProps {
  metrics: DashboardMetric[];
}

const METRIC_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'total-questions': BookOpen,
  'total-competitions': Trophy,
  'total-tests': ClipboardCheck,
  'total-students': Users,
};

const TONE_CLASSES: Record<DashboardMetric['accentTone'], string> = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/70 dark:text-sky-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400',
};

export function StatsGrid({ metrics }: StatsGridProps) {
  return (
    <section aria-label="الإحصائيات المختصرة">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
          نظرة سريعة على النشاط
        </h3>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          أرقام تجريبية لمعاينة التخطيط
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.id] ?? BookOpen;
          return (
            <div
              key={metric.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {metric.label}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display tabular-nums text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {metric.value}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {metric.unitLabel}
                    </span>
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

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {metric.detailText}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
