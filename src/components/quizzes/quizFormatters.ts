import type { QuestionDifficulty } from '../../types/questionBank';

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

const DATE_FORMATTER = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function formatQuizDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return DATE_FORMATTER.format(parsed);
}

export function formatDurationArabic(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0 ثانية';
  }
  if (totalSeconds < 60) {
    return `${totalSeconds} ثانية`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) {
    return `${minutes} دقيقة`;
  }
  return `${minutes} د · ${seconds} ث`;
}
