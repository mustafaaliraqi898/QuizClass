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
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="4.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8.5 10.2C8.5 8.65 9.85 7.5 11.7 7.5C13.45 7.5 14.7 8.55 14.7 10.05C14.7 11.2 13.95 11.9 12.8 12.55C12 13 11.75 13.4 11.75 14.2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="11.75" cy="16.85" r="1.15" fill="currentColor" />
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
