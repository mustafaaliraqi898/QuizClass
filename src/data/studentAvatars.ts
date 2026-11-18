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
    bgClass: 'bg-selected',
    textClass: 'text-accent',
    emoji: '🤖',
    primaryColor: '#536E91',
    secondaryColor: '#38669B',
    bellyColor: '#EDF2F8',
    accentColor: '#8EACD0',
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
    primaryColor: '#384659',
    secondaryColor: '#252F3D',
    bellyColor: '#FAF9F7',
    accentColor: '#D4891C',
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
    bgClass: 'bg-amber-100 dark:bg-amber-950/60',
    textClass: 'text-amber-800 dark:text-amber-300',
    emoji: '🦉',
    primaryColor: '#8B5E3C',
    secondaryColor: '#5E3D25',
    bellyColor: '#F6EDE4',
    accentColor: '#D4891C',
    defaultCelebration: 'wave',
  },
  {
    id: 'avatar_alien',
    label: 'فضائي ودود',
    bgClass: 'bg-success-soft',
    textClass: 'text-success-ink',
    emoji: '👽',
    primaryColor: '#2E7D5B',
    secondaryColor: '#1F5C41',
    bellyColor: '#D7EFE2',
    accentColor: '#536E91',
    defaultCelebration: 'jump',
  },
  {
    id: 'avatar_koala',
    label: 'كوالا هادئ',
    bgClass: 'bg-stone-200 dark:bg-stone-800',
    textClass: 'text-stone-700 dark:text-stone-300',
    emoji: '🐨',
    primaryColor: '#78716C',
    secondaryColor: '#57534E',
    bellyColor: '#E7E5E4',
    accentColor: '#44403C',
    defaultCelebration: 'clap',
  },
  {
    id: 'avatar_panda',
    label: 'باندا لطيف',
    bgClass: 'bg-zinc-200 dark:bg-zinc-800',
    textClass: 'text-zinc-900 dark:text-zinc-100',
    emoji: '🐼',
    primaryColor: '#FAF9F7',
    secondaryColor: '#302D32',
    bellyColor: '#FFFFFF',
    accentColor: '#2E7D5B',
    defaultCelebration: 'dance',
  },
  {
    id: 'avatar_tiger',
    label: 'نمر نشيط',
    bgClass: 'bg-amber-300/80 dark:bg-amber-950/80',
    textClass: 'text-amber-950 dark:text-amber-200',
    emoji: '🐯',
    primaryColor: '#F97316',
    secondaryColor: '#302D32',
    bellyColor: '#FFEDD5',
    accentColor: '#EA580C',
    defaultCelebration: 'victory',
  },
  {
    id: 'avatar_bunny',
    label: 'أرنب سريع',
    bgClass: 'bg-rose-100 dark:bg-rose-950/60',
    textClass: 'text-rose-700 dark:text-rose-300',
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
