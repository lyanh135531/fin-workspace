import React from "react";

interface FinLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function FinLogo({
  size = 28,
  className = "",
  showText = false,
}: FinLogoProps) {
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
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="11"
          fill="#ffe8e4"
          stroke="#FF765B"
          strokeWidth="1.35"
        />
        <path d="M10 9H26V13H14V16H23V20H14V27H10V9Z" fill="#FF765B" />
      </svg>
      {showText && (
        <span className="font-extrabold text-lg tracking-tight text-foreground">
          Felix
        </span>
      )}
    </div>
  );
}
