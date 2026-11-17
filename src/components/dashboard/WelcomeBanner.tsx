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
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
            <span>لوحة المعلم</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400">{teacher.role}</span>
          </div>

          <h2 className="font-display max-w-2xl text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl dark:text-white">
            مرحباً بك، {teacher.name}
          </h2>

          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
            مساحة العمل جاهزة لإدارة بنك أسئلتك وتجهيز مسابقات صفية تفاعلية أو اختبارات فردية
            لطلابك بسرعة ووضوح.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('create-quiz')}
              className="inline-flex h-11 items-center gap-2.5 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <PlusCircle className="h-4 w-4" />
              <span>إنشاء مسابقة جديدة</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('question-bank')}
              className="inline-flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>استعراض بنك الأسئلة</span>
            </button>
          </div>
        </div>

        <div className="hidden lg:col-span-4 lg:flex lg:justify-end">
          <div className="w-full max-w-[280px] rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>معاينة شاشة الصف</span>
              <span className="tabular-nums text-indigo-600 dark:text-indigo-400">PIN · 482910</span>
            </div>
            <div className="space-y-2.5">
              <div className="h-3 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex h-11 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
                  أ. التسارع الثابت
                </div>
                <div className="flex h-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                  ب. القوة المحصلة
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>اتصال محلي مباشر</span>
                <span className="tabular-nums">32 مشاركاً</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
