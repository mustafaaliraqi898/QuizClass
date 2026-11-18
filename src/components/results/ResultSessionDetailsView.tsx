import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Hash,
  HelpCircle,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  ArchivedParticipantRecord,
  ArchivedResultSessionDetails,
} from '../../types/resultsArchive';
import { AnimatedFullBodyAvatar } from '../live/AnimatedFullBodyAvatar';
import {
  formatAccuracyPercent,
  formatArchiveDateTime,
} from './resultFormatters';

interface ResultSessionDetailsViewProps {
  details: ArchivedResultSessionDetails;
  onBackToArchiveList: () => void;
  onSelectParticipant: (participant: ArchivedParticipantRecord) => void;
}

export function ResultSessionDetailsView({
  details,
  onBackToArchiveList,
  onSelectParticipant,
}: ResultSessionDetailsViewProps) {
  const { session, participants } = details;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToArchiveList}
          className="qc-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى قائمة النتائج</span>
        </button>
      </div>

      {/* بطاقة معلومات المسابقة المؤرشفة */}
      <section className="qc-card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-muted">
              <span>نتيجة مسابقة مكتملة ومؤرشفة</span>
              {session.quizSubject && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{session.quizSubject}</span>
                </>
              )}
              {session.quizGrade && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{session.quizGrade}</span>
                </>
              )}
            </div>

            <h2 className="font-display text-2xl font-black text-ink">
              {session.quizTitle}
            </h2>

            <div className="tabular-nums flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>تاريخ الانتهاء: {formatArchiveDateTime(session.endedAt ?? session.archivedAt)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 shrink-0" />
                <span>رمز الجلسة: {session.pinCode}</span>
              </span>
              <span>
                الاحتساب:{' '}
                {session.scoringMode === 'speed_and_accuracy'
                  ? 'السرعة والدقة'
                  : 'الدقة فقط'}
              </span>
            </div>
          </div>

          <dl className="tabular-nums grid grid-cols-2 gap-3 sm:min-w-[260px]">
            <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3 text-center">
              <dt className="text-[11px] font-bold text-ink-muted">عدد المشاركين</dt>
              <dd className="font-display mt-1 text-xl font-black text-ink">
                {session.participantCount}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3 text-center">
              <dt className="text-[11px] font-bold text-ink-muted">عدد الأسئلة</dt>
              <dd className="font-display mt-1 text-xl font-black text-accent">
                {session.questionCount}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* جدول الترتيب النهائي ونتائج المشاركين */}
      <section className="qc-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
          <div>
            <h3 className="font-display text-base font-extrabold text-ink">
              الترتيب النهائي ونتائج المشاركين
            </h3>
            <p className="mt-0.5 text-xs font-medium text-ink-muted">
              اضغط على «عرض الإجابات» لأي مشارك لاستعراض إجاباته سؤالاً بسؤال.
            </p>
          </div>
          <span className="tabular-nums text-xs font-bold text-ink-muted">
            إجمالي المشاركين: {participants.length}
          </span>
        </div>

        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <Users className="h-10 w-10 text-ink-muted" />
            <p className="font-display mt-3 text-base font-extrabold text-ink">
              لم يشارك أي طالب في هذه الجلسة
            </p>
            <p className="mt-1 text-xs font-medium text-ink-muted">
              تم حفظ سجل المسابقة والأسئلة في الأرشيف بدون مشاركين.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line bg-surface-subtle text-xs font-extrabold text-ink-muted">
                <tr>
                  <th className="px-5 py-3.5 text-start">الترتيب</th>
                  <th className="px-4 py-3.5 text-start">المشارك</th>
                  <th className="px-4 py-3.5 text-center">مجموع النقاط</th>
                  <th className="px-4 py-3.5 text-center">الصحيحة</th>
                  <th className="px-4 py-3.5 text-center">الخاطئة</th>
                  <th className="px-4 py-3.5 text-center">غير المجابة</th>
                  <th className="px-4 py-3.5 text-center">نسبة الدقة</th>
                  <th className="px-5 py-3.5 text-end">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {participants.map((participant) => {
                  const rank = participant.rankPosition;
                  const isTopThree = rank !== null && rank >= 1 && rank <= 3;

                  return (
                    <tr
                      key={participant.id}
                      className="transition-colors hover:bg-row-hover"
                    >
                      <td className="px-5 py-3.5">
                        {rank !== null ? (
                          <span
                            className={`tabular-nums inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 font-display text-xs font-black ${
                              rank === 1
                                ? 'bg-warning-soft text-warning-ink'
                                : isTopThree
                                  ? 'bg-selected text-accent'
                                  : 'bg-surface-subtle text-ink-muted'
                            }`}
                          >
                            {rank === 1 && <Trophy className="h-3.5 w-3.5" />}
                            <span>{rank}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-ink-muted">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle">
                            <AnimatedFullBodyAvatar
                              avatarId={participant.avatarId}
                              size="sm"
                              animated={false}
                            />
                          </div>
                          <span className="font-display font-bold text-ink">
                            {participant.displayName}
                          </span>
                        </div>
                      </td>

                      <td className="tabular-nums px-4 py-3.5 text-center font-display text-base font-black text-accent">
                        {participant.totalScore}
                      </td>

                      <td className="tabular-nums px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-success-ink">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{participant.correctCount}</span>
                        </span>
                      </td>

                      <td className="tabular-nums px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-danger-ink">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>{participant.wrongCount}</span>
                        </span>
                      </td>

                      <td className="tabular-nums px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-ink-muted">
                          <HelpCircle className="h-3.5 w-3.5" />
                          <span>{participant.unansweredCount}</span>
                        </span>
                      </td>

                      <td className="tabular-nums px-4 py-3.5 text-center font-bold text-ink">
                        {formatAccuracyPercent(participant.accuracyPercent)}
                      </td>

                      <td className="px-5 py-3.5 text-end">
                        <button
                          type="button"
                          onClick={() => onSelectParticipant(participant)}
                          className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap"
                        >
                          <span>عرض الإجابات</span>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
