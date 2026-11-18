import { Check, ChevronLeft, ChevronRight, MonitorPlay, Presentation, Sparkles, Swords, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { getStudentAvatar, STUDENT_AVATARS } from '../../data/studentAvatars';

export interface CompetitionPlayer {
  name: string;
  avatarId: string;
}

export interface CompetitionSetup {
  player1: CompetitionPlayer;
  player2: CompetitionPlayer;
}

interface InteractiveLearningLaunchSetupProps {
  onStartStandard: () => void;
  onStartCompetition: (setup: CompetitionSetup) => void;
}

function AvatarPicker({
  player,
  value,
  onChange,
  onNameChange,
  color,
}: {
  player: 'الأول' | 'الثاني';
  value: CompetitionPlayer;
  onChange: (avatarId: string) => void;
  onNameChange: (name: string) => void;
  color: 'blue' | 'green';
}) {
  const selected = getStudentAvatar(value.avatarId);
  const isBlue = color === 'blue';
  return (
    <section className={`rounded-3xl border-2 p-5 sm:p-6 ${isBlue ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-sky-100' : 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-4 py-2 text-sm font-black ${isBlue ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>المتسابق {player}</span>
        <span className={`text-xs font-black ${isBlue ? 'text-blue-700' : 'text-emerald-700'}`}>{isBlue ? 'P1' : 'P2'}</span>
      </div>
      <div className="my-4 flex justify-center">
        <div className={`flex h-28 w-28 items-center justify-center rounded-full border-4 bg-white text-6xl shadow-lg ${isBlue ? 'border-blue-400' : 'border-emerald-400'}`} aria-label={selected.label}>
          {selected.emoji}
        </div>
      </div>
      <label className="mb-2 block text-sm font-extrabold text-slate-800">اسم الطالب</label>
      <div className="relative">
        <UserRound className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input value={value.name} onChange={(event) => onNameChange(event.target.value)} maxLength={30} placeholder={`اكتب اسم الطالب ${player}`} className={`h-12 w-full rounded-xl border-2 bg-white pr-12 pl-4 text-right font-bold text-slate-900 outline-none focus:ring-4 ${isBlue ? 'border-blue-300 focus:border-blue-500 focus:ring-blue-100' : 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-100'}`} />
      </div>
      <p className="mb-3 mt-4 text-sm font-extrabold text-slate-800">اختر الشخصية الرمزية</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {STUDENT_AVATARS.map((avatar) => (
          <button key={avatar.id} type="button" onClick={() => onChange(avatar.id)} aria-label={avatar.label} aria-pressed={value.avatarId === avatar.id} title={avatar.label} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 transition-all hover:-translate-y-0.5 ${value.avatarId === avatar.id ? (isBlue ? 'border-blue-600 bg-white shadow-md ring-2 ring-blue-200' : 'border-emerald-600 bg-white shadow-md ring-2 ring-emerald-200') : 'border-white/80 bg-white/70 hover:border-slate-300'}`}>
            <span className="text-2xl">{avatar.emoji}</span>
            <span className="max-w-full truncate text-[10px] font-bold text-slate-700">{avatar.label}</span>
            {value.avatarId === avatar.id && <Check className={`h-3.5 w-3.5 ${isBlue ? 'text-blue-600' : 'text-emerald-600'}`} />}
          </button>
        ))}
      </div>
    </section>
  );
}

export function InteractiveLearningLaunchSetup({ onStartStandard, onStartCompetition }: InteractiveLearningLaunchSetupProps) {
  const [selectedMode, setSelectedMode] = useState<'standard' | 'competition'>('competition');
  const [player1, setPlayer1] = useState<CompetitionPlayer>({ name: '', avatarId: 'avatar_robot' });
  const [player2, setPlayer2] = useState<CompetitionPlayer>({ name: '', avatarId: 'avatar_alien' });

  const start = () => {
    if (selectedMode === 'standard') {
      onStartStandard();
      return;
    }
    onStartCompetition({
      player1: { ...player1, name: player1.name.trim() || 'الطالب الأول' },
      player2: { ...player2, name: player2.name.trim() || 'الطالب الثاني' },
    });
  };

  return (
    <div data-testid="interactive-launch-setup" dir="rtl" className="mx-auto w-full max-w-6xl space-y-7 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/50 to-violet-50 p-5 shadow-xl sm:p-8">
      <header className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-inner"><Presentation className="h-9 w-9" /></div>
        <h2 className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">التعلّم التفاعلي</h2>
        <p className="mt-2 text-sm font-medium text-slate-600">اختر نمط التشغيل وجهّز المنافسة قبل عرض الأسئلة</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button type="button" onClick={() => setSelectedMode('competition')} aria-pressed={selectedMode === 'competition'} className={`group rounded-3xl border-2 p-6 text-center transition-all ${selectedMode === 'competition' ? 'border-emerald-500 bg-gradient-to-br from-emerald-800 to-green-700 text-white shadow-xl ring-4 ring-emerald-200' : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:shadow-lg'}`}>
          <Swords className="mx-auto h-12 w-12" />
          <h3 className="mt-3 text-xl font-black">منافسة طالبين</h3>
          <p className={`mt-1 text-sm ${selectedMode === 'competition' ? 'text-emerald-50' : 'text-slate-500'}`}>تحدٍّ تفاعلي بين طالبين بنظام النقاط والمؤقت</p>
          {selectedMode === 'competition' && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><Check className="h-4 w-4" /> تم الاختيار</span>}
        </button>
        <button type="button" onClick={() => setSelectedMode('standard')} aria-pressed={selectedMode === 'standard'} className={`rounded-3xl border-2 p-6 text-center transition-all ${selectedMode === 'standard' ? 'border-blue-500 bg-gradient-to-br from-blue-800 to-indigo-700 text-white shadow-xl ring-4 ring-blue-200' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:shadow-lg'}`}>
          <MonitorPlay className="mx-auto h-12 w-12" />
          <h3 className="mt-3 text-xl font-black">وضع الشرح العادي</h3>
          <p className={`mt-1 text-sm ${selectedMode === 'standard' ? 'text-blue-50' : 'text-slate-500'}`}>عرض الأسئلة ومناقشتها مع الصف بالطريقة المعتادة</p>
          {selectedMode === 'standard' && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><Check className="h-4 w-4" /> تم الاختيار</span>}
        </button>
      </div>

      {selectedMode === 'competition' && (
        <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-5 py-5 text-center sm:px-7">
            <div className="flex items-center justify-center gap-2 text-blue-700"><Users className="h-6 w-6" /><h3 className="text-xl font-black text-slate-900">إعداد المنافسة</h3><Sparkles className="h-5 w-5 text-amber-500" /></div>
            <p className="mt-1 text-sm text-slate-500">أدخل اسم كل طالب واختر شخصيته قبل بدء التحدي</p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 sm:p-6">
            <AvatarPicker player="الأول" value={player1} onChange={(avatarId) => setPlayer1((current) => ({ ...current, avatarId }))} onNameChange={(name) => setPlayer1((current) => ({ ...current, name }))} color="blue" />
            <AvatarPicker player="الثاني" value={player2} onChange={(avatarId) => setPlayer2((current) => ({ ...current, avatarId }))} onNameChange={(name) => setPlayer2((current) => ({ ...current, name }))} color="green" />
          </div>
        </section>
      )}

      <div className="flex justify-center">
        <button type="button" onClick={start} className="inline-flex h-14 min-w-64 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-700 px-8 text-base font-black text-white shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:shadow-xl">
          {selectedMode === 'competition' ? 'ابدأ المنافسة' : 'ابدأ عرض السبورة'}
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <p className="text-center text-xs text-slate-400">يمكنك الرجوع إلى الأنشطة دون التأثير على الأسئلة المحفوظة</p>
    </div>
  );
}
