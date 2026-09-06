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
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Primary Symbol Vector (Exact Manasyn Intersecting Loops Geometry)
  // Transparent mask cutout eliminates any white fringing/halo across any background
  const SymbolSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label={isDecorative ? undefined : 'Manasyn Symbol'}
      aria-hidden={isDecorative}
    >
      <defs>
        <mask id={`manasyn-mask-${safeId}`}>
          {/* Base: render everything */}
          <rect width="100" height="100" fill="white" />
          {/* Cutout: black stroke cuts out the section directly under the teal crossover */}
          <path
            d="M 42 50 C 38 60, 46 74, 56 72 L 68 20 C 72 10, 84 10, 88 20 L 92 56"
            stroke="black"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      {/* Purple/Indigo Arch with transparent mask cutout */}
      <path
        d="M 18 78 L 38 20 C 42 10, 54 10, 58 20 L 70 56 C 73 65, 65 74, 56 72 C 48 70, 44 60, 48 50"
        stroke="#5A4CE3"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#manasyn-mask-${safeId})`}
      />

      {/* Teal Arch rendered on top */}
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
      className="inline-flex items-center gap-2.5 sm:gap-3 select-none"
      aria-label={isDecorative ? undefined : 'Manasyn'}
      aria-hidden={isDecorative}
    >
      {SymbolSvg}
      <span
        className={`font-sans font-bold tracking-tight text-slate-900 dark:text-white ${
          size >= 48 ? 'text-2xl sm:text-3xl' : size >= 36 ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
        }`}
        style={wordmarkColor ? { color: wordmarkColor } : undefined}
      >
        Manasyn
      </span>
    </div>
  );
};
