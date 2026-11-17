import { Award, CheckCircle2, HelpCircle, Medal, RefreshCw, Trophy, Users, XCircle } from 'lucide-react';
import type { TeacherLiveSessionDetails } from '../../types/liveSession';

interface LiveFinalResultsViewProps {
  session: TeacherLiveSessionDetails;
  onLaunchNewSession: () => void;
  onBackToQuizzes: () => void;
}

export function LiveFinalResultsView({
  session,
  onLaunchNewSession,
  onBackToQuizzes,
}: LiveFinalResultsViewProps) {
  const leaderboard = session.finalResults ?? [];
  const topThree = leaderboard.slice(0, 3);

  const podiumStyle = (rank: number) => {
    if (rank === 1) {
      return {
        wrapper:
          'border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/40',
        badge: 'bg-amber-500 text-white',
        icon: Trophy,
        label: 'المركز الأول',
      };
    }
    if (rank === 2) {
      return {
        wrapper:
          'border-slate-300 bg-slate-100/80 dark:border-slate-600 dark:bg-slate-800/70',
        badge: 'bg-slate-600 text-white',
        icon: Medal,
        label: 'المركز الثاني',
      };
    }
    return {
      wrapper:
        'border-orange-300 bg-orange-50/80 dark:border-orange-800 dark:bg-orange-950/30',
      badge: 'bg-orange-600 text-white',
      icon: Award,
      label: 'المركز الثالث',
    };
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Trophy className="h-3.5 w-3.5" />
              <span>النتائج النهائية للمسابقة</span>
            </span>
            <h2 className="font-display mt-2.5 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
              {session.quizTitle}
            </h2>
            <p className="tabular-nums mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {session.questionCount} سؤالاً · {leaderboard.length} مشاركاً · رمز {session.pinCode} ·{' '}
              {session.settings.scoringMode === 'speed_and_accuracy'
                ? 'احتساب السرعة وصحة الإجابة'
                : 'صحة الإجابة فقط'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onLaunchNewSession}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <RefreshCw className="h-4 w-4" />
              <span>تشغيل جلسة جديدة</span>
            </button>
            <button
              type="button"
              onClick={onBackToQuizzes}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              العودة إلى المسابقات
            </button>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="font-display mt-3 text-base font-bold text-slate-900 dark:text-white">
              لم يشارك أي طالب في هذه الجلسة
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* منصة المراكز الثلاثة الأولى */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {topThree.map((entry) => {
                const meta = podiumStyle(entry.rankPosition);
                const Icon = meta.icon;
                return (
                  <div
                    key={entry.participantId}
                    className={`rounded-2xl border-2 p-5 text-center ${meta.wrapper}`}
                  >
                    <div
                      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl shadow-xs ${meta.badge}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-xs font-extrabold text-slate-600 dark:text-slate-300">
                      {meta.label}
                    </p>
                    <h3 className="font-display mt-1 truncate text-lg font-extrabold text-slate-900 dark:text-white">
                      {entry.displayName}
                    </h3>
                    <p className="tabular-nums font-display mt-2 text-3xl font-black text-indigo-700 dark:text-indigo-300">
                      {entry.totalScore}
                      <span className="ms-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                        نقطة
                      </span>
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-3 text-xs font-bold">
                      <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                        {entry.correctCount} صحيح
                      </span>
                      <span className="tabular-nums text-red-700 dark:text-red-300">
                        {entry.wrongCount} خطأ
                      </span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-400">
                        {entry.unansweredCount} لم يجب
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* جدول الترتيب الكامل */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3.5 text-start">الترتيب</th>
                      <th className="px-4 py-3.5 text-start">اسم الطالب</th>
                      <th className="px-4 py-3.5 text-center">إجمالي النقاط</th>
                      <th className="px-4 py-3.5 text-center">الصحيحة</th>
                      <th className="px-4 py-3.5 text-center">الخاطئة</th>
                      <th className="px-4 py-3.5 text-center">غير المجابة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {leaderboard.map((entry) => (
                      <tr
                        key={entry.participantId}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <span className="tabular-nums inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 font-display text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            {entry.rankPosition}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-display font-bold text-slate-900 dark:text-white">
                          {entry.displayName}
                        </td>
                        <td className="tabular-nums px-4 py-3.5 text-center font-display font-black text-indigo-700 dark:text-indigo-300">
                          {entry.totalScore}
                        </td>
                        <td className="tabular-nums px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{entry.correctCount}</span>
                          </span>
                        </td>
                        <td className="tabular-nums px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-red-700 dark:text-red-300">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{entry.wrongCount}</span>
                          </span>
                        </td>
                        <td className="tabular-nums px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-600 dark:text-slate-400">
                            <HelpCircle className="h-3.5 w-3.5" />
                            <span>{entry.unansweredCount}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
