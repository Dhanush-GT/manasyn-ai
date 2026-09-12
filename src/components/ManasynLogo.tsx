import React from 'react';

interface ManasynLogoProps {
  size?: number;
  showWordmark?: boolean;
  variant?: 'icon' | 'full' | string;
  isDecorative?: boolean;
  className?: string;
}

export const ManasynLogo: React.FC<ManasynLogoProps> = ({
  size = 32,
  showWordmark = true,
  variant,
  isDecorative,
  className = '',
}) => {
  const shouldShowWordmark = (variant === 'icon' || variant === 'symbol' || !showWordmark) ? false : true;

  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-hidden={isDecorative ? 'true' : undefined}>
      <img
        src="/brand/manasyn-symbol-512.png"
        alt="Manasyn"
        style={{ width: size, height: size }}
        className="aspect-square object-contain shrink-0"
      />
      {shouldShowWordmark && (
        <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">
          Manasyn
        </span>
      )}
    </div>
  );
};