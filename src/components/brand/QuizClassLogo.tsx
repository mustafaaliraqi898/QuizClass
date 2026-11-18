interface QuizClassLogoProps {
  collapsed?: boolean;
}

export function QuizClassLogo({ collapsed = false }: QuizClassLogoProps) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs"
        aria-hidden="true"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="4" y="7" width="24" height="19" rx="3.5" stroke="currentColor" strokeWidth="2" />
          <path d="M9 12H17M9 16H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M19 17L22 20L27 13" stroke="#35D39A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 4.5L16 2L24 4.5L16 7L8 4.5Z" fill="#F8C84E" />
          <path d="M24 5V9" stroke="#F8C84E" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="24" cy="10" r="1.2" fill="#F8C84E" />
        </svg>
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <span className="font-display block text-lg font-extrabold tracking-tight text-ink whitespace-nowrap">
            QuizClass
          </span>
          <span className="block text-[11px] font-medium text-ink-muted whitespace-nowrap">
            منصة المسابقات الصفية
          </span>
        </div>
      )}
    </div>
  );
}
