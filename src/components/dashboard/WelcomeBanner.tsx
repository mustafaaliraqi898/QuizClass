import { BookOpen, PlusCircle } from 'lucide-react';
import type { NavSectionId, TeacherProfile } from '../../types/dashboard';

interface WelcomeBannerProps {
  teacher: TeacherProfile;
  onNavigate: (section: NavSectionId) => void;
}

export function WelcomeBanner({ teacher, onNavigate }: WelcomeBannerProps) {
  return (
    <section
      aria-label="الترحيب بالمعلم"
      className="qc-card relative overflow-hidden p-6 sm:p-8"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-accent">
          <span>لوحة المعلم</span>
          <span aria-hidden="true" className="text-line-strong">
            ·
          </span>
          <span className="text-ink-muted">{teacher.role}</span>
        </div>

        <h2 className="font-display max-w-2xl text-2xl font-extrabold leading-snug text-ink sm:text-3xl">
          مرحباً بك، {teacher.name}
        </h2>

        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted sm:text-base">
          مساحة العمل جاهزة لإدارة بنك أسئلتك وتجهيز مسابقات صفية تفاعلية مباشرة عبر الشبكة المحلية
          لطلابك بسرعة ووضوح تام دون الحاجة للإنترنت.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-3">
          <button
            type="button"
            onClick={() => onNavigate('create-quiz')}
            className="qc-btn-primary inline-flex h-11 items-center gap-2.5 rounded-xl px-5 text-sm font-bold whitespace-nowrap shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>إنشاء مسابقة جديدة</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('question-bank')}
            className="qc-btn-secondary inline-flex h-11 items-center gap-2.5 rounded-xl px-5 text-sm font-bold whitespace-nowrap shrink-0"
          >
            <BookOpen className="h-4 w-4 text-accent" />
            <span>استعراض بنك الأسئلة</span>
          </button>
        </div>
      </div>
    </section>
  );
}
