import React from 'react';

interface ImpulsaCapLogoProps {
  className?: string;
  size?: number;
  withText?: boolean;
  withTagline?: boolean;
  variant?: 'light' | 'dark';
}

export const ImpulsaCapLogo: React.FC<ImpulsaCapLogoProps> = ({
  className = '',
  size = 36,
  withText = true,
  withTagline = false,
  variant = 'light',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* 
        Símbolo ImpulsaCap:
        Escudo dinámico de despegue y aceleración de capital (Cap)
        en gradiente azul profundo y verde esmeralda.
      */}
      <div 
        className="relative flex items-center justify-center shrink-0 rounded-2xl bg-gradient-to-tr from-blue-600 via-teal-500 to-emerald-500 p-0.5 shadow-md shadow-blue-500/20"
        style={{ width: size, height: size }}
      >
        <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center shadow-inner">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-3/4 h-3/4"
          >
            <defs>
              <linearGradient id="impulsa_grad" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563EB" />
                <stop offset="0.5" stopColor="#0D9488" />
                <stop offset="1" stopColor="#10B981" />
              </linearGradient>
              <linearGradient id="impulsa_arrow" x1="10" y1="22" x2="22" y2="8" gradientUnits="userSpaceOnUse">
                <stop stopColor="#059669" />
                <stop offset="1" stopColor="#3B82F6" />
              </linearGradient>
            </defs>

            {/* Base Shield / Foundation */}
            <path
              d="M16 3L5 7.5V15C5 21.8 9.7 28.1 16 29.5C22.3 28.1 27 21.8 27 15V7.5L16 3Z"
              fill="url(#impulsa_grad)"
              opacity="0.15"
            />
            <path
              d="M16 3L5 7.5V15C5 21.8 9.7 28.1 16 29.5C22.3 28.1 27 21.8 27 15V7.5L16 3Z"
              stroke="url(#impulsa_grad)"
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {/* Dynamic Upward Growth Arrow (Impulso & Capital) */}
            <path
              d="M16 8L22 14H18V22H14V14H10L16 8Z"
              fill="url(#impulsa_arrow)"
            />

            {/* Sparkle of innovation */}
            <circle cx="21" cy="9" r="1.5" fill="#10B981" />
          </svg>
        </div>
      </div>

      {/* Tipografía ImpulsaCap */}
      {withText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-black text-xl tracking-tight text-slate-900">
              Impulsa<span className="text-emerald-600">Cap</span>
            </span>
            <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Chile
            </span>
          </div>
          {withTagline && (
            <span className="text-[10px] text-slate-500 font-medium tracking-tight mt-0.5">
              Capital & Fondos Concursables con IA
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Backwards compatibility alias
export const InkiLogo = ImpulsaCapLogo;
