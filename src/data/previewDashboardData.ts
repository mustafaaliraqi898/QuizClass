import type {
  DashboardMetric,
  ModuleRoadmapInfo,
  NavItem,
  NavSectionId,
  QuickShortcut,
  TeacherProfile,
} from '../types/dashboard';

export const TEACHER_PROFILE: TeacherProfile = {
  name: 'المعلم',
  role: 'معلم الصف',
  school: 'المدرسة',
  avatarPath: '',
};

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    description: 'نظرة عامة على النشاط والاختصارات',
  },
  {
    id: 'question-bank',
    label: 'بنك الأسئلة',
    description: 'إدارة وتصنيف الأسئلة التعليمية',
  },
  {
    id: 'create-quiz',
    label: 'إنشاء مسابقة',
    description: 'تجهيز مسابقة جديدة أو اختبار فردي',
  },
  {
    id: 'quizzes',
    label: 'المسابقات',
    description: 'سجل المسابقات الجاهزة والمنتهية',
  },
  {
    id: 'live-session',
    label: 'البث المباشر',
    description: 'تشغيل المسابقة واستقبال الطلاب عبر Wi-Fi',
  },
  {
    id: 'interactive-learning',
    label: 'التعلم التفاعلي',
    description: 'عرض الأسئلة على السبورة الذكية والتفاعل المباشر باللمس',
  },
  {
    id: 'reports',
    label: 'النتائج والتقارير',
    description: 'تحليل درجات الطلاب وترتيبهم',
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    description: 'تخصيص المظهر وتفضيلات التطبيق',
  },
];

// إزالة الإحصائيات الوهمية; تقتصر الإحصائيات على المصادر الحقيقية من قاعدة البيانات
export const PREVIEW_METRICS: DashboardMetric[] = [];


export const QUICK_SHORTCUTS: QuickShortcut[] = [
  {
    id: 'shortcut-add-question',
    title: 'إضافة سؤال جديد',
    subtitle: 'اختيار من متعدد أو صح وخطأ مع صور',
    targetSection: 'question-bank',
    accentTone: 'indigo',
    contextNote: 'الاختصار المختار: نموذج إضافة سؤال جديد (اختيار من متعدد أو صح/خطأ).',
  },
  {
    id: 'shortcut-question-bank',
    title: 'فتح بنك الأسئلة',
    subtitle: 'تصفح وتصفية الأسئلة حسب المادة والصف',
    targetSection: 'question-bank',
    accentTone: 'sky',
    contextNote: 'الاختصار المختار: تصفح وتصفية بنك الأسئلة التعليمي.',
  },
  {
    id: 'shortcut-create-quiz',
    title: 'إنشاء مسابقة جديدة',
    subtitle: 'بناء مسابقة يدوية أو سحب أسئلة عشوائية',
    targetSection: 'create-quiz',
    accentTone: 'emerald',
  },
  {
    id: 'shortcut-view-reports',
    title: 'عرض النتائج',
    subtitle: 'مراجعة أداء الطلاب وترتيب المتصدرين',
    targetSection: 'reports',
    accentTone: 'violet',
  },
];

export const MODULE_ROADMAP: Record<
  Exclude<NavSectionId, 'dashboard' | 'settings' | 'live-session' | 'interactive-learning'>,
  ModuleRoadmapInfo
> = {
  'question-bank': {
    id: 'question-bank',
    title: 'بنك الأسئلة',
    subtitle: 'إدارة مركزية للأسئلة التعليمية مع التصنيف المرن وإرفاق الوسائط.',
    phaseNote: 'سيتم تنفيذ هذا القسم في المرحلة القادمة بعد اعتماد الهوية البصرية ولوحة التحكم.',
    plannedCapabilities: [
      {
        title: 'أسئلة اختيار من متعدد وصح أو خطأ',
        detail: 'محرر واضح لإدخال نص السؤال، تحديد الإجابة الصحيحة، وضبط زمن الإجابة.',
      },
      {
        title: 'إرفاق الصور بالأسئلة والخيارات',
        detail: 'دعم الصور التوضيحية والرسوم البيانية محلياً دون الحاجة للاتصال بالإنترنت.',
      },
      {
        title: 'التصنيف والبحث المتقدم',
        detail: 'تصفية اختيارية حسب المادة الدراسية، الصف، الموضوع، ومستوى الصعوبة.',
      },
    ],
    architectureHint: 'التخزين المخطط: قاعدة بيانات SQLite محلية على جهاز المعلم.',
  },
  'create-quiz': {
    id: 'create-quiz',
    title: 'إنشاء مسابقة',
    subtitle: 'منشئ مسابقات واختبارات مرن يتيح التجهيز اليدوي أو السحب الذكي من البنك.',
    phaseNote: 'سيتم تنفيذ منشئ المسابقات في المراحل القادمة بناءً على هيكلية هذا التصميم.',
    plannedCapabilities: [
      {
        title: 'اختيار يدوي أو عشوائي للأسئلة',
        detail: 'انتقاء أسئلة محددة أو توليد مسابقة عشوائية وفق المادة ومستوى الصعوبة.',
      },
      {
        title: 'نمط المسابقة الجماعية أو الاختبار الفردي',
        detail: 'تحديد أسلوب العرض، عداد الثواني، ونظام احتساب النقاط والسرعة.',
      },
      {
        title: 'معاينة فورية قبل التشغيل',
        detail: 'مراجعة تسلسل الأسئلة والتأكد من وضوح الشرائح للعرض الصفي.',
      },
    ],
    architectureHint: 'الربط المخطط: واجهة بناء متصلة مباشرة بجداول الأسئلة والمسابقات.',
  },
  quizzes: {
    id: 'quizzes',
    title: 'المسابقات',
    subtitle: 'إطلاق الجلسات الصفية المباشرة وإدارة المسابقات الجاهزة والمسودات.',
    phaseNote: 'نظام التشغيل الفوري والاتصال عبر الشبكة المحلية مخصص للمراحل القادمة.',
    plannedCapabilities: [
      {
        title: 'تشغيل مباشر داخل الصف عبر الشبكة المحلية',
        detail: 'استضافة الجلسة على حاسوب المعلم عبر نقطة اتصال Wi-Fi أو راوتر المدرسة.',
      },
      {
        title: 'انضمام الطلاب عبر QR Code أو PIN',
        detail: 'دخول فوري من متصفح هاتف الطالب دون الحاجة لتثبيت أي تطبيق.',
      },
      {
        title: 'تحكم كامل بسير الجلسة',
        detail: 'شاشة انتظار المشاركين، بدء السؤال، عرض الإحصاءات الفورية، ولوحة الصدارة.',
      },
    ],
    architectureHint: 'الاتصال المخطط: خادم Node.js محلي مع Socket.IO للاتصال اللحظي.',
  },
  reports: {
    id: 'reports',
    title: 'النتائج والتقارير',
    subtitle: 'رؤية دقيقة لإجابات الطلاب، نسب الإتقان، وترتيب المشاركين بعد كل جلسة.',
    phaseNote: 'محرك التقارير التفصيلية سيتم ربطه ببيانات الجلسات في المرحلة القادمة.',
    plannedCapabilities: [
      {
        title: 'ترتيب الطلاب ومؤشرات الأداء',
        detail: 'عرض المراكز الأولى، الدرجات الإجمالية، ومتوسط زمن الاستجابة لكل طالب.',
      },
      {
        title: 'تحليل الأسئلة الأكثر صعوبة',
        detail: 'تحديد الأسئلة التي أخطأ فيها معظم الطلاب لمراجعتها داخل الحصة.',
      },
      {
        title: 'حفظ ومراجعة السجلات محلياً',
        detail: 'أرشفة نتائج المسابقات والاختبارات الفردية لمتابعة تطور الفصول.',
      },
    ],
    architectureHint: 'البيانات المخططة: استعلامات تحليلية محلية على نتائج الجلسات المحفوظة.',
  },
};
