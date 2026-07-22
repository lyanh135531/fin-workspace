import React from "react";

interface FinLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function FinLogo({ size = 28, className = "", showText = false }: FinLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-200 hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="finLogoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff5b3d" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id="finLogoGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <filter id="finLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#ff5b3d" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Outer squircle base */}
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="10"
          fill="url(#finLogoGrad1)"
          filter="url(#finLogoGlow)"
        />

        {/* Minimalist F & Financial Growth Vector Lines */}
        {/* Vertical primary bar of F */}
        <rect x="9.5" y="9" width="4" height="18" rx="2" fill="#ffffff" />

        {/* Top horizontal arm of F merged with growth wave */}
        <path
          d="M13.5 11C13.5 9.89543 14.3954 9 15.5 9H23.5C24.6046 9 25.5 9.89543 25.5 11C25.5 12.1046 24.6046 13 23.5 13H13.5V11Z"
          fill="#ffffff"
        />

        {/* Middle horizontal arm of F with dynamic angle */}
        <path
          d="M13.5 17C13.5 15.8954 14.3954 15 15.5 15H20.5C21.6046 15 22.5 15.8954 22.5 17C22.5 18.1046 21.6046 19 20.5 19H13.5V17Z"
          fill="#ffffff"
          fillOpacity="0.88"
        />

        {/* Growth dot indicator at top right */}
        <circle cx="24.5" cy="23.5" r="2" fill="#ffffff" fillOpacity="0.9" />
      </svg>
      {showText && (
        <span className="font-extrabold text-base tracking-tight text-foreground">
          Fin Workspace
        </span>
      )}
    </div>
  );
}
