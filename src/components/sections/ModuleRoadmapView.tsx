import { ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import type { ModuleRoadmapInfo, NavSectionId } from '../../types/dashboard';

interface ModuleRoadmapViewProps {
  moduleInfo: ModuleRoadmapInfo;
  onNavigate: (section: NavSectionId) => void;
}

export function ModuleRoadmapView({ moduleInfo, onNavigate }: ModuleRoadmapViewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Layers className="h-4 w-4" />
              <span>خارطة تطوير المرحلة القادمة</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
              {moduleInfo.title}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
              {moduleInfo.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة إلى لوحة التحكم</span>
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-indigo-200/70 bg-indigo-50/70 p-4 text-xs font-medium leading-relaxed text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
          {moduleInfo.phaseNote}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {moduleInfo.plannedCapabilities.map((cap, index) => (
          <div
            key={cap.title}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                <span className="tabular-nums">0{index + 1}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {cap.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {cap.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {moduleInfo.architectureHint}
      </div>
    </div>
  );
}
