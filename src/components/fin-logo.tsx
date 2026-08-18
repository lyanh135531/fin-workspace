import React, { useId } from "react";

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
  const id = useId().replaceAll(":", "");
  const clipId = `${id}-clip`;
  const markId = `${id}-mark`;
  const accentId = `${id}-accent`;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-200 hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="2" y="2" width="60" height="60" rx="15" />
          </clipPath>
          <linearGradient id={markId} x1="15" y1="10" x2="52" y2="49">
            <stop stopColor="var(--primary, #3155f5)" />
            <stop offset="1" stopColor="var(--secondary, #7d6df1)" />
          </linearGradient>
          <linearGradient id={accentId} x1="20" y1="11" x2="45" y2="38">
            <stop stopColor="var(--secondary, #7d6df1)" stopOpacity="0.18" />
            <stop
              offset="1"
              stopColor="var(--surface, #ffffff)"
              stopOpacity="0.36"
            />
          </linearGradient>
        </defs>

        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="15"
          fill="var(--surface, #ffffff)"
          stroke="var(--border, #dce3ef)"
        />
        <g clipPath={`url(#${clipId})`}>
          <circle
            cx="4"
            cy="2"
            r="18"
            fill="color-mix(in srgb, var(--primary, #3155f5) 12%, transparent)"
          />
          <circle
            cx="64"
            cy="65"
            r="23"
            fill="color-mix(in srgb, var(--secondary, #7d6df1) 15%, transparent)"
          />
        </g>

        <g transform="translate(0, 4)">
          <path
            d="M15.4 50.4c-2.2-.2-3.3-1.8-2.8-4.3l4.9-27.3C19 10.7 25.2 6.6 34.6 6.6h14.8c3.5 0 5.1 2.1 4.3 5.3-1.6 6.5-6.7 10.2-14.3 10.2h-7.2c-5.8 0-9.3 3.1-10.4 9.1l-2.2 11.9c-.9 4.9-1.9 7.7-4.2 7.3Z"
            fill={`url(#${markId})`}
          />
          <path
            d="M28.3 41.2 30 32c.8-4.5 4.2-7.1 9-7.1h9.8c2.9 0 4.2 1.8 3.4 4.5-1.9 7.2-7 11.8-14.9 11.8h-9Z"
            fill={`url(#${markId})`}
            transform="translate(-3, 2)"
          />
          <path
            d="M18.2 35.2c4.7-9.7 11.6-18.5 23.2-24.7-11.7 2.1-19.3 8.5-22.2 18.9l-1 5.8Z"
            fill={`url(#${accentId})`}
          />
        </g>
      </svg>
      {showText && (
        <span className="text-lg font-extrabold tracking-tight text-[var(--foreground)]">
          Felix
        </span>
      )}
    </div>
  );
}
