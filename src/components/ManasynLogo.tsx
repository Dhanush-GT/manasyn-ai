import React, { useId } from 'react';

interface ManasynLogoProps {
  className?: string;
  size?: number;
  variant?: 'symbol' | 'full';
  showWordmark?: boolean;
  wordmarkColor?: string;
  isDecorative?: boolean;
}

export const ManasynLogo: React.FC<ManasynLogoProps> = ({
  className = '',
  size = 32,
  variant = 'full',
  showWordmark,
  wordmarkColor,
  isDecorative = false,
}) => {
  const isFull = variant === 'full' || showWordmark === true;
  const rawId = useId();
  const maskId = `manasyn-mask-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const SymbolSvg = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label={isDecorative ? undefined : 'Manasyn Symbol'}
      aria-hidden={isDecorative}
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          <path
            d="M 42 50 C 38 60, 46 74, 56 72 L 68 20 C 72 10, 84 10, 88 20 L 92 56"
            stroke="black"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      {/* Purple/Indigo Ribbon Arch with dynamic mask for interlocking depth */}
      <path
        d="M 18 78 L 38 20 C 42 10, 54 10, 58 20 L 70 56 C 73 65, 65 74, 56 72 C 48 70, 44 60, 48 50"
        stroke="#5A4CE3"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
      />
      {/* Emerald/Teal Ribbon Arch */}
      <path
        d="M 42 50 C 38 60, 46 74, 56 72 L 68 20 C 72 10, 84 10, 88 20 L 92 56"
        stroke="#2CB59B"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!isFull) {
    return SymbolSvg;
  }

  return (
    <div
      className="inline-flex items-center gap-2.5 select-none"
      aria-label={isDecorative ? undefined : 'Manasyn'}
      aria-hidden={isDecorative}
    >
      {SymbolSvg}
      <span
        className={`font-display font-bold tracking-tight text-slate-900 dark:text-white leading-none ${
          size >= 48
            ? 'text-2xl sm:text-3xl'
            : size >= 36
            ? 'text-xl sm:text-2xl'
            : size >= 28
            ? 'text-lg sm:text-xl'
            : 'text-base font-semibold'
        }`}
        style={wordmarkColor ? { color: wordmarkColor } : undefined}
      >
        Manasyn
      </span>
    </div>
  );
};


