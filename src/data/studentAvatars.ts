export type AvatarCelebrationStyle = 'jump' | 'wave' | 'clap' | 'dance' | 'victory';

export interface StudentAvatarOption {
  id: string;
  label: string;
  bgClass: string;
  textClass: string;
  emoji: string;
  primaryColor: string;
  secondaryColor: string;
  bellyColor: string;
  accentColor: string;
  defaultCelebration: AvatarCelebrationStyle;
}

export const STUDENT_AVATARS: StudentAvatarOption[] = [
  {
    id: 'avatar_cat',
    label: 'قطة لطيفة',
    bgClass: 'bg-amber-100 dark:bg-amber-950/60',
    textClass: 'text-amber-700 dark:text-amber-300',
    emoji: '🐱',
    primaryColor: '#F59E0B',
    secondaryColor: '#D97706',
    bellyColor: '#FEF3C7',
    accentColor: '#FB7185',
    defaultCelebration: 'wave',
  },
  {
    id: 'avatar_robot',
    label: 'روبوت ذكي',
    bgClass: 'bg-sky-100 dark:bg-sky-950/60',
    textClass: 'text-sky-700 dark:text-sky-300',
    emoji: '🤖',
    primaryColor: '#0284C7',
    secondaryColor: '#0369A1',
    bellyColor: '#BAE6FD',
    accentColor: '#38BDF8',
    defaultCelebration: 'dance',
  },
  {
    id: 'avatar_fox',
    label: 'ثعلب ذكي',
    bgClass: 'bg-orange-100 dark:bg-orange-950/60',
    textClass: 'text-orange-700 dark:text-orange-300',
    emoji: '🦊',
    primaryColor: '#EA580C',
    secondaryColor: '#9A3412',
    bellyColor: '#FFEDD5',
    accentColor: '#FDBA74',
    defaultCelebration: 'jump',
  },
  {
    id: 'avatar_bear',
    label: 'دب لطيف',
    bgClass: 'bg-amber-200 dark:bg-amber-900/60',
    textClass: 'text-amber-900 dark:text-amber-200',
    emoji: '🐻',
    primaryColor: '#92400E',
    secondaryColor: '#78350F',
    bellyColor: '#FDE68A',
    accentColor: '#D97706',
    defaultCelebration: 'clap',
  },
  {
    id: 'avatar_penguin',
    label: 'بطريق مرح',
    bgClass: 'bg-blue-100 dark:bg-blue-950/60',
    textClass: 'text-blue-700 dark:text-blue-300',
    emoji: '🐧',
    primaryColor: '#1E293B',
    secondaryColor: '#0F172A',
    bellyColor: '#F8FAFC',
    accentColor: '#F59E0B',
    defaultCelebration: 'dance',
  },
  {
    id: 'avatar_lion',
    label: 'أسد شجاع',
    bgClass: 'bg-yellow-100 dark:bg-yellow-950/60',
    textClass: 'text-yellow-800 dark:text-yellow-300',
    emoji: '🦁',
    primaryColor: '#EAB308',
    secondaryColor: '#B45309',
    bellyColor: '#FEF08A',
    accentColor: '#92400E',
    defaultCelebration: 'victory',
  },
  {
    id: 'avatar_owl',
    label: 'بومة حكيمة',
    bgClass: 'bg-purple-100 dark:bg-purple-950/60',
    textClass: 'text-purple-700 dark:text-purple-300',
    emoji: '🦉',
    primaryColor: '#7E22CE',
    secondaryColor: '#581C87',
    bellyColor: '#F3E8FF',
    accentColor: '#FBBF24',
    defaultCelebration: 'wave',
  },
  {
    id: 'avatar_alien',
    label: 'فضائي ودود',
    bgClass: 'bg-emerald-100 dark:bg-emerald-950/60',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    emoji: '👽',
    primaryColor: '#10B981',
    secondaryColor: '#047857',
    bellyColor: '#A7F3D0',
    accentColor: '#6366F1',
    defaultCelebration: 'jump',
  },
  {
    id: 'avatar_koala',
    label: 'كوالا هادئ',
    bgClass: 'bg-slate-200 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    emoji: '🐨',
    primaryColor: '#64748B',
    secondaryColor: '#475569',
    bellyColor: '#E2E8F0',
    accentColor: '#334155',
    defaultCelebration: 'clap',
  },
  {
    id: 'avatar_panda',
    label: 'باندا لطيف',
    bgClass: 'bg-zinc-200 dark:bg-zinc-800',
    textClass: 'text-zinc-900 dark:text-zinc-100',
    emoji: '🐼',
    primaryColor: '#F8FAFC',
    secondaryColor: '#1E293B',
    bellyColor: '#FFFFFF',
    accentColor: '#10B981',
    defaultCelebration: 'dance',
  },
  {
    id: 'avatar_tiger',
    label: 'نمر نشيط',
    bgClass: 'bg-amber-300/80 dark:bg-amber-950/80',
    textClass: 'text-amber-950 dark:text-amber-200',
    emoji: '🐯',
    primaryColor: '#F97316',
    secondaryColor: '#1E293B',
    bellyColor: '#FFEDD5',
    accentColor: '#EA580C',
    defaultCelebration: 'victory',
  },
  {
    id: 'avatar_bunny',
    label: 'أرنب سريع',
    bgClass: 'bg-pink-100 dark:bg-pink-950/60',
    textClass: 'text-pink-700 dark:text-pink-300',
    emoji: '🐰',
    primaryColor: '#F472B6',
    secondaryColor: '#DB2777',
    bellyColor: '#FCE7F3',
    accentColor: '#FB7185',
    defaultCelebration: 'jump',
  },
];

export function getStudentAvatar(avatarId: string | null | undefined): StudentAvatarOption {
  const found = STUDENT_AVATARS.find((a) => a.id === avatarId);
  return found ?? STUDENT_AVATARS[0];
}
