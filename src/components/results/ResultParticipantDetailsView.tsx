import {
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ArchivedParticipantDetailsResponse,
  ArchivedParticipantQuestionBreakdown,
} from '../../types/resultsArchive';
import { AnimatedFullBodyAvatar } from '../live/AnimatedFullBodyAvatar';
import {
  formatAccuracyPercent,
  formatArchiveDateTime,
  formatResponseSeconds,
} from './resultFormatters';

interface ResultParticipantDetailsViewProps {
  details: ArchivedParticipantDetailsResponse;
  onBackToSession: () => void;
  onBackToArchiveList: () => void;
}

function SafeArchiveImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="mt-2 h-16 w-24 rounded-lg border border-line bg-surface-subtle object-contain p-1"
    />
  );
}

function renderParticipantAnswerCell(q: ArchivedParticipantQuestionBreakdown) {
  if (q.outcome === 'unanswered') {
    return <span className="text-xs font-bold text-ink-muted">لم يجب</span>;
  }

  const responseSec = formatResponseSeconds(q.responseTimeMs);

  if (q.type === 'true_false') {
    const label =
      q.selectedBoolean === true ? 'صح' : q.selectedBoolean === false ? 'خطأ' : '—';
    return (
      <div className="space-y-1">
        <span className="text-sm font-bold text-ink">{label}</span>
        {responseSec && (
          <p className="tabular-nums flex items-center gap-1 text-[11px] font-medium text-ink-muted">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{responseSec}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-bold text-ink">
        {q.selectedOptionText ?? (q.selectedOptionImageUrl ? 'صورة الخيار' : '—')}
      </p>
      {q.selectedOptionImageUrl && (
        <SafeArchiveImage src={q.selectedOptionImageUrl} alt="صورة إجابة المشارك" />
      )}
      {responseSec && (
        <p className="tabular-nums flex items-center gap-1 text-[11px] font-medium text-ink-muted">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{responseSec}</span>
        </p>
      )}
    </div>
  );
}

function renderCorrectAnswerCell(q: ArchivedParticipantQuestionBreakdown) {
  if (q.type === 'true_false') {
    const label =
      q.correctBoolean === true ? 'صح' : q.correctBoolean === false ? 'خطأ' : '—';
    return <span className="text-sm font-bold text-success-ink">{label}</span>;
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-bold text-success-ink">
        {q.correctOptionText ?? (q.correctOptionImageUrl ? 'صورة الإجابة الصحيحة' : '—')}
      </p>
      {q.correctOptionImageUrl && (
        <SafeArchiveImage src={q.correctOptionImageUrl} alt="صورة الإجابة الصحيحة" />
      )}
    </div>
  );
}

export function ResultParticipantDetailsView({
  details,
  onBackToSession,
  onBackToArchiveList,
}: ResultParticipantDetailsViewProps) {
  const { session, participant, questions } = details;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToSession}
          className="qc-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى تفاصيل المسابقة</span>
        </button>

        <button
          type="button"
          onClick={onBackToArchiveList}
          className="text-xs font-bold text-ink-muted transition-colors hover:text-accent"
        >
          عرض جميع المسابقات المؤرشفة
        </button>
      </div>

      {/* ملخص المشارك في الجلسة المؤرشفة */}
      <section className="qc-card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-subtle p-1">
              <AnimatedFullBodyAvatar
                avatarId={participant.avatarId}
                size="sm"
                animated={false}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-ink-muted">
                {session.quizTitle} · {formatArchiveDateTime(session.endedAt ?? session.archivedAt)}
              </p>
              <h2 className="font-display text-xl font-black text-ink sm:text-2xl">
                {participant.displayName}
              </h2>
              <div className="tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-ink-muted">
                {participant.rankPosition !== null && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>المركز {participant.rankPosition}</span>
                  </span>
                )}
                <span>عدد الأسئلة: {session.questionCount}</span>
                <span>نسخة محفوظة كما وردت وقت المسابقة</span>
              </div>
            </div>
          </div>

          <dl className="tabular-nums grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-center">
              <dt className="text-[11px] font-bold text-ink-muted">إجمالي النقاط</dt>
              <dd className="font-display mt-0.5 text-lg font-black text-accent">
                {participant.totalScore}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-center">
              <dt className="text-[11px] font-bold text-ink-muted">الصحيحة</dt>
              <dd className="font-display mt-0.5 text-lg font-black text-success-ink">
                {participant.correctCount}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-center">
              <dt className="text-[11px] font-bold text-ink-muted">الخاطئة</dt>
              <dd className="font-display mt-0.5 text-lg font-black text-danger-ink">
                {participant.wrongCount}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-center">
              <dt className="text-[11px] font-bold text-ink-muted">غير المجابة</dt>
              <dd className="font-display mt-0.5 text-lg font-black text-ink">
                {participant.unansweredCount}
              </dd>
            </div>
            <div className="col-span-2 rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-center sm:col-span-1">
              <dt className="text-[11px] font-bold text-ink-muted">نسبة الدقة</dt>
              <dd className="font-display mt-0.5 text-lg font-black text-ink">
                {formatAccuracyPercent(participant.accuracyPercent)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* جدول تفصيل الأسئلة والإجابات */}
      <section className="qc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3 className="font-display text-base font-extrabold text-ink">
              تفاصيل إجابات المشارك سؤالاً بسؤال
            </h3>
            <p className="mt-0.5 text-xs font-medium text-ink-muted">
              عرض مطابق لنسخة الأسئلة والاختيارات المحفوظة وقت انعقاد الجلسة.
            </p>
          </div>
          <span className="tabular-nums text-xs font-bold text-ink-muted">
            {questions.length} سؤالاً
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm font-bold text-ink-muted">
            لا توجد أسئلة مسجلة في أرشيف هذه الجلسة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line bg-surface-subtle text-xs font-extrabold text-ink-muted">
                <tr>
                  <th className="px-5 py-3.5 text-start">السؤال</th>
                  <th className="px-4 py-3.5 text-start">إجابة المشارك</th>
                  <th className="px-4 py-3.5 text-start">الإجابة الصحيحة</th>
                  <th className="px-4 py-3.5 text-center">النتيجة</th>
                  <th className="px-4 py-3.5 text-center">النقاط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {questions.map((q, idx) => (
                  <tr key={q.archiveQuestionId} className="align-top transition-colors hover:bg-row-hover">
                    <td className="min-w-[240px] max-w-md px-5 py-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                          <span className="tabular-nums text-accent">
                            سؤال {idx + 1}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {q.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ'}
                          </span>
                        </div>
                        <p className="font-display text-sm font-bold leading-relaxed text-ink">
                          {q.prompt}
                        </p>
                        {q.imageUrl && (
                          <SafeArchiveImage src={q.imageUrl} alt={`صورة السؤال ${idx + 1}`} />
                        )}
                      </div>
                    </td>

                    <td className="min-w-[160px] px-4 py-4">
                      {renderParticipantAnswerCell(q)}
                    </td>

                    <td className="min-w-[160px] px-4 py-4">
                      {renderCorrectAnswerCell(q)}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {q.outcome === 'correct' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-success-ink">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>صحيحة</span>
                        </span>
                      ) : q.outcome === 'wrong' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-danger-ink">
                          <XCircle className="h-4 w-4 shrink-0" />
                          <span>خاطئة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                          <HelpCircle className="h-4 w-4 shrink-0" />
                          <span>غير مجاب</span>
                        </span>
                      )}
                    </td>

                    <td className="tabular-nums px-4 py-4 text-center font-display text-sm font-black text-ink">
                      {q.pointsAwarded > 0 ? `+${q.pointsAwarded}` : q.pointsAwarded}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
