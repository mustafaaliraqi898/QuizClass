import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  Calendar,
  ChevronLeft,
  Clock,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { httpResultsArchiveService } from '../../services/resultsArchiveService';
import type {
  ArchivedParticipantDetailsResponse,
  ArchivedParticipantRecord,
  ArchivedResultSessionDetails,
  ArchivedSessionSummary,
} from '../../types/resultsArchive';
import { ResultParticipantDetailsView } from './ResultParticipantDetailsView';
import { ResultSessionDetailsView } from './ResultSessionDetailsView';
import {
  formatArchiveDateOnly,
  formatArchiveTimeOnly,
  localDateToUtcIsoRange,
} from './resultFormatters';

type ResultsViewStage = 'list' | 'session' | 'participant';

export function ResultsArchiveView() {
  const [stage, setStage] = useState<ResultsViewStage>('list');

  // حالة قائمة الأرشيف والتصفية
  const [archives, setArchives] = useState<ArchivedSessionSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // حالة تفاصيل الجلسة
  const [selectedSession, setSelectedSession] = useState<ArchivedResultSessionDetails | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // حالة تفاصيل إجابات المشارك
  const [selectedParticipant, setSelectedParticipant] =
    useState<ArchivedParticipantDetailsResponse | null>(null);
  const [isParticipantLoading, setIsParticipantLoading] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);

  const loadArchives = useCallback(
    async (signal?: AbortSignal) => {
      setIsListLoading(true);
      setListError(null);
      try {
        const range = selectedDate ? localDateToUtcIsoRange(selectedDate) : null;
        const result = await httpResultsArchiveService.listArchivedResults(
          {
            search: searchQuery.trim() || undefined,
            dateFrom: range?.dateFrom,
            dateTo: range?.dateTo,
            sort: sortOrder,
          },
          { signal }
        );
        setArchives(result.archives);
        setTotalCount(result.totalCount);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setListError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل أرشيف نتائج المسابقات من قاعدة البيانات.'
        );
      } finally {
        setIsListLoading(false);
      }
    },
    [searchQuery, selectedDate, sortOrder]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadArchives(controller.signal);
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadArchives]);

  const handleOpenSessionDetails = useCallback(async (archiveId: string) => {
    setIsSessionLoading(true);
    setSessionError(null);
    setParticipantError(null);
    try {
      const details = await httpResultsArchiveService.getArchivedResultById(archiveId);
      setSelectedSession(details);
      setSelectedParticipant(null);
      setStage('session');
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل تفاصيل نتيجة المسابقة المطلوبة.'
      );
    } finally {
      setIsSessionLoading(false);
    }
  }, []);

  const handleOpenParticipantDetails = useCallback(
    async (archiveId: string, participant: ArchivedParticipantRecord) => {
      setIsParticipantLoading(true);
      setParticipantError(null);
      try {
        const details = await httpResultsArchiveService.getArchivedParticipantDetails(
          archiveId,
          participant.id
        );
        setSelectedParticipant(details);
        setStage('participant');
      } catch (error) {
        setParticipantError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل إجابات المشارك المطلوبة.'
        );
      } finally {
        setIsParticipantLoading(false);
      }
    },
    []
  );

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedDate.length > 0;

  if (stage === 'participant' && selectedParticipant) {
    return (
      <ResultParticipantDetailsView
        details={selectedParticipant}
        onBackToSession={() => {
          setSelectedParticipant(null);
          setParticipantError(null);
          setStage('session');
        }}
        onBackToArchiveList={() => {
          setSelectedParticipant(null);
          setSelectedSession(null);
          setParticipantError(null);
          setSessionError(null);
          setStage('list');
        }}
      />
    );
  }

  if (stage === 'session' && selectedSession) {
    return (
      <div className="space-y-4">
        {participantError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-danger-line bg-danger-soft px-5 py-3.5 text-xs font-bold text-danger-ink"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{participantError}</span>
            </div>
            <button
              type="button"
              onClick={() => setParticipantError(null)}
              aria-label="إغلاق التنبيه"
              className="rounded-lg p-1 hover:bg-row-hover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {isParticipantLoading && (
          <div className="qc-card flex items-center justify-center gap-2.5 px-6 py-4 text-xs font-bold text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span>جارٍ تحميل تفاصيل إجابات المشارك...</span>
          </div>
        )}

        <ResultSessionDetailsView
          details={selectedSession}
          onBackToArchiveList={() => {
            setSelectedSession(null);
            setSelectedParticipant(null);
            setSessionError(null);
            setParticipantError(null);
            setStage('list');
          }}
          onSelectParticipant={(participant) =>
            void handleOpenParticipantDetails(selectedSession.session.id, participant)
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* شريط العنوان والتصفية */}
      <section className="qc-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-ink">
              أرشيف نتائج المسابقات
            </h2>
            <p className="mt-1 text-xs font-medium text-ink-muted">
              <span className="tabular-nums">
                إجمالي المسابقات المؤرشفة: {totalCount}
              </span>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              <span>محفوظة دائماً في قاعدة البيانات المحلية ومحمية من التعديلات اللاحقة</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadArchives()}
            disabled={isListLoading}
            className="qc-btn-secondary inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isListLoading ? 'animate-spin' : ''}`} />
            <span>تحديث الأرشيف</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-line pt-5 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المسابقة أو المادة أو رمز الجلسة..."
              aria-label="البحث في أرشيف نتائج المسابقات"
              className="qc-input h-10 w-full rounded-xl pe-3 ps-9 text-xs"
            />
          </div>

          <div className="relative md:col-span-3">
            <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="تصفية النتائج حسب التاريخ"
              className="qc-input h-10 w-full rounded-xl pe-3 ps-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 md:col-span-3">
            <div className="relative flex-1">
              <ArrowUpDown className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value === 'oldest' ? 'oldest' : 'newest')
                }
                aria-label="ترتيب النتائج"
                className="qc-input h-10 w-full rounded-xl pe-3 ps-9 text-xs font-bold"
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDate('');
                }}
                aria-label="مسح التصفية"
                className="qc-btn-secondary inline-flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold"
              >
                <X className="h-4 w-4" />
                <span>مسح</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {sessionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-danger-line bg-danger-soft px-5 py-3.5 text-xs font-bold text-danger-ink"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{sessionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSessionError(null)}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-row-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isSessionLoading && (
        <div className="qc-card flex items-center justify-center gap-2.5 px-6 py-4 text-xs font-bold text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>جارٍ تحميل تفاصيل المسابقة والترتيب النهائي...</span>
        </div>
      )}

      {listError ? (
        <div
          role="alert"
          className="qc-card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
        >
          <AlertCircle className="h-9 w-9 text-danger-ink" />
          <p className="font-display text-base font-extrabold text-ink">{listError}</p>
          <button
            type="button"
            onClick={() => void loadArchives()}
            className="qc-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
          >
            <RefreshCw className="h-4 w-4" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      ) : isListLoading && archives.length === 0 ? (
        <div className="qc-card flex items-center justify-center gap-2.5 px-6 py-16 text-sm font-bold text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span>جارٍ تحميل أرشيف نتائج المسابقات...</span>
        </div>
      ) : archives.length === 0 ? (
        <div className="qc-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <BarChart3 className="h-11 w-11 text-ink-muted" />
          <p className="font-display mt-3 text-base font-extrabold text-ink">
            {hasActiveFilters
              ? 'لا توجد مسابقات مؤرشفة مطابقة لشروط البحث أو التاريخ'
              : 'لا توجد نتائج مسابقات مؤرشفة حتى الآن'}
          </p>
          <p className="mt-1 max-w-md text-xs font-medium text-ink-muted">
            {hasActiveFilters
              ? 'جرّب تعديل كلمة البحث أو مسح التاريخ المحدد لعرض جميع النتائج المحفوظة.'
              : 'عند انتهاء أي مسابقة مباشرة في الفصل، يتم حفظ نتائجها وترتيب المشاركين وإجاباتهم تلقائياً هنا.'}
          </p>
        </div>
      ) : (
        <section className="qc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line bg-surface-subtle text-xs font-extrabold text-ink-muted">
                <tr>
                  <th className="px-5 py-3.5 text-start">المسابقة</th>
                  <th className="px-4 py-3.5 text-start">تاريخ التنفيذ</th>
                  <th className="px-4 py-3.5 text-center">المشاركون</th>
                  <th className="px-4 py-3.5 text-center">الأسئلة</th>
                  <th className="px-4 py-3.5 text-start">وقت الانتهاء</th>
                  <th className="px-5 py-3.5 text-end">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {archives.map((archive) => {
                  const completedTimestamp = archive.endedAt ?? archive.archivedAt;
                  const metaLine = [archive.quizSubject, archive.quizGrade]
                    .filter((item): item is string => Boolean(item && item.trim()))
                    .join(' · ');

                  return (
                    <tr
                      key={archive.id}
                      className="transition-colors hover:bg-row-hover"
                    >
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <p className="font-display text-sm font-extrabold text-ink">
                            {archive.quizTitle}
                          </p>
                          <p className="tabular-nums text-xs font-medium text-ink-muted">
                            {metaLine ? `${metaLine} · ` : ''}
                            رمز الجلسة: {archive.pinCode}
                          </p>
                        </div>
                      </td>

                      <td className="tabular-nums px-4 py-4 text-xs font-bold text-ink">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-ink-muted" />
                          <span>{formatArchiveDateOnly(completedTimestamp)}</span>
                        </span>
                      </td>

                      <td className="tabular-nums px-4 py-4 text-center text-xs font-bold text-ink">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-ink-muted" />
                          <span>{archive.participantCount}</span>
                        </span>
                      </td>

                      <td className="tabular-nums px-4 py-4 text-center text-xs font-bold text-ink">
                        <span className="inline-flex items-center gap-1">
                          <HelpCircle className="h-3.5 w-3.5 text-ink-muted" />
                          <span>{archive.questionCount}</span>
                        </span>
                      </td>

                      <td className="tabular-nums px-4 py-4 text-xs font-bold text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatArchiveTimeOnly(completedTimestamp)}</span>
                        </span>
                      </td>

                      <td className="px-5 py-4 text-end">
                        <button
                          type="button"
                          onClick={() => void handleOpenSessionDetails(archive.id)}
                          disabled={isSessionLoading}
                          className="qc-btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap disabled:opacity-60"
                        >
                          <span>عرض النتائج والتفاصيل</span>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
