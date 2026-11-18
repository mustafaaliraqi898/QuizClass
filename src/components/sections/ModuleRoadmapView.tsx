import { ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import type { ModuleRoadmapInfo, NavSectionId } from '../../types/dashboard';

interface ModuleRoadmapViewProps {
  moduleInfo: ModuleRoadmapInfo;
  contextNote?: string;
  onNavigate: (section: NavSectionId) => void;
}

export function ModuleRoadmapView({
  moduleInfo,
  contextNote,
  onNavigate,
}: ModuleRoadmapViewProps) {
  return (
    <div className="space-y-6">
      <div className="qc-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-accent">
              <Layers className="h-4 w-4" />
              <span>خارطة تطوير المرحلة القادمة</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink">
              {moduleInfo.title}
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted sm:text-base">
              {moduleInfo.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="qc-btn-secondary inline-flex h-10 items-center gap-2 self-start rounded-xl px-4 text-xs font-bold whitespace-nowrap shrink-0"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة إلى لوحة التحكم</span>
          </button>
        </div>

        <div className="mt-6 space-y-2 rounded-xl border border-selected-line bg-selected p-4 text-xs font-medium leading-relaxed text-ink">
          {contextNote && <p className="font-bold">{contextNote}</p>}
          <p>{moduleInfo.phaseNote}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {moduleInfo.plannedCapabilities.map((cap, index) => (
          <div key={cap.title} className="qc-card flex flex-col justify-between p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-ink-muted">
                <span className="tabular-nums">0{index + 1}</span>
                <CheckCircle2 className="h-4 w-4 text-success-ink" />
              </div>
              <h3 className="font-display text-base font-bold text-ink">{cap.title}</h3>
              <p className="text-xs leading-relaxed text-ink-muted">{cap.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="qc-card px-6 py-4 text-xs font-medium text-ink-muted">
        {moduleInfo.architectureHint}
      </div>
    </div>
  );
}
