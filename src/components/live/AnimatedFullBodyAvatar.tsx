import {
  getStudentAvatar,
  type AvatarCelebrationStyle,
} from '../../data/studentAvatars';

interface AnimatedFullBodyAvatarProps {
  avatarId: string | null | undefined;
  celebration?: AvatarCelebrationStyle;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCrown?: boolean;
  animated?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AnimatedFullBodyAvatarProps['size']>, string> = {
  sm: 'h-12 w-10',
  md: 'h-20 w-16',
  lg: 'h-32 w-26 sm:h-36 sm:w-28',
  xl: 'h-36 w-28 sm:h-44 sm:w-36',
};

export function AnimatedFullBodyAvatar({
  avatarId,
  celebration,
  size = 'lg',
  showCrown = false,
  animated = true,
  className = '',
}: AnimatedFullBodyAvatarProps) {
  const avatar = getStudentAvatar(avatarId);
  const activeCelebration = celebration ?? avatar.defaultCelebration;
  const celebrationClass = animated ? `qc-cel-${activeCelebration}` : '';

  const isRobot = avatar.id === 'avatar_robot';
  const isAlien = avatar.id === 'avatar_alien';
  const isOwl = avatar.id === 'avatar_owl';
  const isPenguin = avatar.id === 'avatar_penguin';
  const isLion = avatar.id === 'avatar_lion';
  const isBunny = avatar.id === 'avatar_bunny';
  const isPanda = avatar.id === 'avatar_panda';
  const isTiger = avatar.id === 'avatar_tiger';
  const isCat = avatar.id === 'avatar_cat';
  const isFox = avatar.id === 'avatar_fox';
  const isBear = avatar.id === 'avatar_bear';
  const isKoala = avatar.id === 'avatar_koala';

  const hasTail = isCat || isFox || isLion || isTiger || isBunny;

  return (
    <svg
      viewBox="0 0 120 150"
      role="img"
      aria-label={avatar.label}
      data-avatar-id={avatar.id}
      data-celebration={activeCelebration}
      className={`select-none overflow-visible ${SIZE_CLASSES[size]} ${celebrationClass} ${className}`}
    >
      {/* Ground Shadow */}
      <ellipse
        cx="60"
        cy="141"
        rx="28"
        ry="6"
        fill="#0F172A"
        opacity="0.2"
        className="qc-avatar-shadow"
      />

      {/* Full-Body Articulated Skeleton */}
      <g className="qc-avatar-body">
        {/* Tail (behind torso) */}
        {hasTail && (
          <g className="qc-avatar-tail">
            {isBunny ? (
              <circle
                cx="30"
                cy="110"
                r="8"
                fill="#FFFFFF"
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
            ) : isFox || isCat || isTiger ? (
              <path
                d="M 38 112 Q 12 108 15 86 Q 18 76 26 82 Q 26 98 40 105 Z"
                fill={avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
            ) : isLion ? (
              <g>
                <path
                  d="M 38 110 Q 14 106 16 86"
                  fill="none"
                  stroke={avatar.primaryColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="83" r="6" fill={avatar.accentColor} />
              </g>
            ) : null}
            {isFox && (
              <circle cx="19" cy="83" r="5" fill="#FFFFFF" />
            )}
          </g>
        )}

        {/* Left & Right Articulated Legs */}
        <g className="qc-avatar-leg-left">
          <rect
            x="40"
            y="112"
            width="14"
            height="22"
            rx="7"
            fill={isPanda ? '#1E293B' : avatar.primaryColor}
            stroke={avatar.secondaryColor}
            strokeWidth="2"
          />
          <ellipse
            cx="47"
            cy="134"
            rx="9"
            ry="5.5"
            fill={isPenguin ? avatar.accentColor : isPanda ? '#1E293B' : avatar.secondaryColor}
          />
        </g>

        <g className="qc-avatar-leg-right">
          <rect
            x="66"
            y="112"
            width="14"
            height="22"
            rx="7"
            fill={isPanda ? '#1E293B' : avatar.primaryColor}
            stroke={avatar.secondaryColor}
            strokeWidth="2"
          />
          <ellipse
            cx="73"
            cy="134"
            rx="9"
            ry="5.5"
            fill={isPenguin ? avatar.accentColor : isPanda ? '#1E293B' : avatar.secondaryColor}
          />
        </g>

        {/* Left & Right Articulated Arms / Wings */}
        <g className="qc-avatar-arm-left">
          {isOwl || isPenguin ? (
            <path
              d="M 36 78 Q 16 86 22 104 Q 28 112 37 100 Z"
              fill={avatar.primaryColor}
              stroke={avatar.secondaryColor}
              strokeWidth="2"
            />
          ) : (
            <g>
              <rect
                x="18"
                y="76"
                width="20"
                height="12"
                rx="6"
                fill={isPanda ? '#1E293B' : avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
              <circle
                cx="18"
                cy="82"
                r="6.5"
                fill={isRobot ? avatar.accentColor : avatar.bellyColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
            </g>
          )}
        </g>

        <g className="qc-avatar-arm-right">
          {isOwl || isPenguin ? (
            <path
              d="M 84 78 Q 104 86 98 104 Q 92 112 83 100 Z"
              fill={avatar.primaryColor}
              stroke={avatar.secondaryColor}
              strokeWidth="2"
            />
          ) : (
            <g>
              <rect
                x="82"
                y="76"
                width="20"
                height="12"
                rx="6"
                fill={isPanda ? '#1E293B' : avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
              <circle
                cx="102"
                cy="82"
                r="6.5"
                fill={isRobot ? avatar.accentColor : avatar.bellyColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
            </g>
          )}
        </g>

        {/* Torso */}
        <g className="qc-avatar-torso">
          {isRobot ? (
            <g>
              <rect
                x="35"
                y="72"
                width="50"
                height="46"
                rx="12"
                fill={avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2.5"
              />
              <rect
                x="43"
                y="81"
                width="34"
                height="24"
                rx="6"
                fill="#0F172A"
              />
              {/* Digital happy energy bars on chest */}
              <rect x="48" y="92" width="5" height="9" rx="2" fill="#38BDF8" />
              <rect x="57" y="87" width="6" height="14" rx="2" fill="#34D399" />
              <rect x="67" y="90" width="5" height="11" rx="2" fill="#FBBF24" />
            </g>
          ) : (
            <g>
              <rect
                x="35"
                y="70"
                width="50"
                height="48"
                rx="22"
                fill={avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2.5"
              />
              {/* Belly Patch */}
              <ellipse
                cx="60"
                cy="95"
                rx="16"
                ry="17"
                fill={avatar.bellyColor}
              />
              {/* Tiger stripes on torso */}
              {isTiger && (
                <g stroke={avatar.secondaryColor} strokeWidth="2.5" strokeLinecap="round">
                  <path d="M 37 86 L 44 88" />
                  <path d="M 37 96 L 43 97" />
                  <path d="M 83 86 L 76 88" />
                  <path d="M 83 96 L 77 97" />
                </g>
              )}
              {/* Alien / Panda / Lion chest star/belt detail */}
              {isAlien && (
                <g>
                  <rect x="37" y="102" width="46" height="6" rx="3" fill={avatar.accentColor} />
                  <circle cx="60" cy="105" r="4" fill="#FBBF24" />
                </g>
              )}
              {isOwl && (
                <g fill={avatar.secondaryColor} opacity="0.28">
                  <path d="M 52 88 Q 55 92 58 88" fill="none" stroke={avatar.secondaryColor} strokeWidth="2" strokeLinecap="round" />
                  <path d="M 62 88 Q 65 92 68 88" fill="none" stroke={avatar.secondaryColor} strokeWidth="2" strokeLinecap="round" />
                  <path d="M 57 96 Q 60 100 63 96" fill="none" stroke={avatar.secondaryColor} strokeWidth="2" strokeLinecap="round" />
                </g>
              )}
            </g>
          )}
        </g>

        {/* Head Group */}
        <g className="qc-avatar-head">
          {/* Lion Mane */}
          {isLion && (
            <g fill={avatar.accentColor}>
              <circle cx="60" cy="45" r="32" />
              <circle cx="34" cy="36" r="10" />
              <circle cx="86" cy="36" r="10" />
              <circle cx="42" cy="18" r="10" />
              <circle cx="78" cy="18" r="10" />
              <circle cx="60" cy="14" r="10" />
            </g>
          )}

          {/* Ears / Antennae / Tufts */}
          {isCat || isFox || isTiger ? (
            <g>
              <path
                d="M 34 32 L 30 10 L 49 23 Z"
                fill={avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M 35 28 L 33 15 L 44 23 Z" fill={avatar.accentColor} />
              <path
                d="M 86 32 L 90 10 L 71 23 Z"
                fill={avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M 85 28 L 87 15 L 76 23 Z" fill={avatar.accentColor} />
            </g>
          ) : isBunny ? (
            <g>
              <ellipse
                cx="45"
                cy="16"
                rx="7"
                ry="17"
                transform="rotate(-10 45 16)"
                fill={avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
              <ellipse
                cx="45"
                cy="16"
                rx="3.5"
                ry="11"
                transform="rotate(-10 45 16)"
                fill="#FCE7F3"
              />
              <ellipse
                cx="75"
                cy="16"
                rx="7"
                ry="17"
                transform="rotate(10 75 16)"
                fill={avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
              <ellipse
                cx="75"
                cy="16"
                rx="3.5"
                ry="11"
                transform="rotate(10 75 16)"
                fill="#FCE7F3"
              />
            </g>
          ) : isBear || isKoala || isPanda ? (
            <g>
              <circle
                cx="34"
                cy="25"
                r={isKoala ? 12 : 9.5}
                fill={isPanda ? '#1E293B' : avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
              <circle
                cx="34"
                cy="25"
                r={isKoala ? 6.5 : 4.5}
                fill={isPanda ? '#334155' : avatar.bellyColor}
              />
              <circle
                cx="86"
                cy="25"
                r={isKoala ? 12 : 9.5}
                fill={isPanda ? '#1E293B' : avatar.primaryColor}
                stroke={avatar.secondaryColor}
                strokeWidth="2"
              />
              <circle
                cx="86"
                cy="25"
                r={isKoala ? 6.5 : 4.5}
                fill={isPanda ? '#334155' : avatar.bellyColor}
              />
            </g>
          ) : isRobot ? (
            <g>
              <line x1="60" y1="20" x2="60" y2="8" stroke={avatar.secondaryColor} strokeWidth="3" />
              <circle cx="60" cy="7" r="5" fill="#FBBF24" />
            </g>
          ) : isAlien ? (
            <g>
              <path d="M 46 22 Q 40 10 35 12" fill="none" stroke={avatar.secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="35" cy="11" r="4" fill="#34D399" stroke={avatar.secondaryColor} strokeWidth="1.5" />
              <path d="M 74 22 Q 80 10 85 12" fill="none" stroke={avatar.secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="85" cy="11" r="4" fill="#34D399" stroke={avatar.secondaryColor} strokeWidth="1.5" />
            </g>
          ) : isOwl ? (
            <g>
              <path d="M 36 25 L 30 14 L 44 21 Z" fill={avatar.secondaryColor} />
              <path d="M 84 25 L 90 14 L 76 21 Z" fill={avatar.secondaryColor} />
            </g>
          ) : null}

          {/* Main Head Shape */}
          {isRobot ? (
            <rect
              x="32"
              y="20"
              width="56"
              height="48"
              rx="14"
              fill={avatar.primaryColor}
              stroke={avatar.secondaryColor}
              strokeWidth="2.5"
            />
          ) : (
            <ellipse
              cx="60"
              cy="45"
              rx="28"
              ry="25"
              fill={avatar.primaryColor}
              stroke={avatar.secondaryColor}
              strokeWidth="2.5"
            />
          )}

          {/* Face Patches */}
          {isPenguin && (
            <path
              d="M 40 42 Q 48 30 60 39 Q 72 30 80 42 Q 82 62 60 66 Q 38 62 40 42 Z"
              fill="#FFFFFF"
            />
          )}
          {isFox && (
            <path
              d="M 33 48 Q 47 45 60 54 Q 73 45 87 48 Q 84 67 60 69 Q 36 67 33 48 Z"
              fill="#FFFFFF"
            />
          )}
          {isOwl && (
            <g>
              <circle cx="48" cy="43" r="11" fill="#FFFFFF" />
              <circle cx="72" cy="43" r="11" fill="#FFFFFF" />
            </g>
          )}
          {isPanda && (
            <g fill="#1E293B">
              <ellipse cx="47" cy="43" rx="8" ry="10" transform="rotate(-18 47 43)" />
              <ellipse cx="73" cy="43" rx="8" ry="10" transform="rotate(18 73 43)" />
            </g>
          )}
          {isRobot && (
            <rect x="38" y="29" width="44" height="24" rx="8" fill="#0F172A" />
          )}

          {/* Eyes */}
          <g className="qc-avatar-eyes">
            {isRobot ? (
              <g fill="#38BDF8">
                <circle cx="49" cy="41" r="4.5" />
                <circle cx="71" cy="41" r="4.5" />
                <circle cx="50.5" cy="39.5" r="1.5" fill="#FFFFFF" />
                <circle cx="72.5" cy="39.5" r="1.5" fill="#FFFFFF" />
              </g>
            ) : (
              <g>
                <circle
                  cx="48"
                  cy="43"
                  r={isAlien ? 5.5 : 4.2}
                  fill={isPanda ? '#FFFFFF' : '#0F172A'}
                />
                <circle
                  cx="72"
                  cy="43"
                  r={isAlien ? 5.5 : 4.2}
                  fill={isPanda ? '#FFFFFF' : '#0F172A'}
                />
                {isPanda ? (
                  <>
                    <circle cx="48" cy="43" r="2.2" fill="#0F172A" />
                    <circle cx="72" cy="43" r="2.2" fill="#0F172A" />
                  </>
                ) : (
                  <>
                    <circle cx="49.5" cy="41.5" r="1.5" fill="#FFFFFF" />
                    <circle cx="73.5" cy="41.5" r="1.5" fill="#FFFFFF" />
                  </>
                )}
              </g>
            )}
          </g>

          {/* Rosy Cheeks */}
          {!isRobot && (
            <g fill="#FB7185" opacity="0.45">
              <ellipse cx="39" cy="52" rx="4.5" ry="2.5" />
              <ellipse cx="81" cy="52" rx="4.5" ry="2.5" />
            </g>
          )}

          {/* Snout / Beak / Nose / Smile */}
          {isPenguin || isOwl ? (
            <path d="M 55 48 L 65 48 L 60 56 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1.2" />
          ) : isRobot ? (
            <path
              d="M 51 59 Q 60 65 69 59"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ) : (
            <g>
              {(isBear || isKoala || isLion || isBunny) && (
                <ellipse cx="60" cy="54" rx="10" ry="7.5" fill={avatar.bellyColor} />
              )}
              <ellipse
                cx="60"
                cy="51"
                rx={isKoala ? 4.5 : 3.5}
                ry={isKoala ? 5.5 : 2.6}
                fill="#0F172A"
              />
              <path
                d="M 53 56 Q 60 63 67 56"
                fill="none"
                stroke="#0F172A"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Cat / Fox / Tiger Whiskers */}
          {(isCat || isFox || isTiger) && (
            <g stroke={avatar.secondaryColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
              <line x1="28" y1="49" x2="38" y2="51" />
              <line x1="28" y1="55" x2="38" y2="54" />
              <line x1="92" y1="49" x2="82" y2="51" />
              <line x1="92" y1="55" x2="82" y2="54" />
            </g>
          )}

          {/* Winner Gold Crown (for 1st place) */}
          {showCrown && (
            <g transform="translate(38, -6)">
              <path
                d="M 4 18 L 2 5 L 13 12 L 22 2 L 31 12 L 42 5 L 40 18 Z"
                fill="#FACC15"
                stroke="#B45309"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="22" cy="11" r="2.2" fill="#EF4444" />
              <circle cx="11" cy="13" r="1.7" fill="#3B82F6" />
              <circle cx="33" cy="13" r="1.7" fill="#10B981" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
