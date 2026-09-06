import React from 'react';

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

  const SymbolImage = (
    <img
      src="/assets/logo.png"
      alt={isDecorative ? '' : 'Manasyn Logo'}
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`shrink-0 object-contain ${className}`}
      aria-label={isDecorative ? undefined : 'Manasyn Symbol'}
      aria-hidden={isDecorative}
    />
  );

  if (!isFull) {
    return SymbolImage;
  }

  return (
    <div
      className="inline-flex items-center gap-2.5 sm:gap-3 select-none"
      aria-label={isDecorative ? undefined : 'Manasyn'}
      aria-hidden={isDecorative}
    >
      {SymbolImage}
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

