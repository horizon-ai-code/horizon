"use client";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function CpuIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="4" width="8" height="8" rx="1" />
      <line x1="4" y1="6" x2="2" y2="6" />
      <line x1="4" y1="7" x2="2" y2="7" />
      <line x1="4" y1="8" x2="2" y2="8" />
      <line x1="4" y1="9" x2="2" y2="9" />
      <line x1="12" y1="6" x2="14" y2="6" />
      <line x1="12" y1="7" x2="14" y2="7" />
      <line x1="12" y1="8" x2="14" y2="8" />
      <line x1="12" y1="9" x2="14" y2="9" />
    </svg>
  );
}

export function MemoryIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="5" y="2" width="6" height="12" rx="1" />
      <line x1="3" y1="6" x2="5" y2="6" />
      <line x1="3" y1="8" x2="5" y2="8" />
      <line x1="11" y1="6" x2="13" y2="6" />
      <line x1="11" y1="8" x2="13" y2="8" />
    </svg>
  );
}

export function GpuIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="4" width="12" height="8" rx="1.5" />
      <line x1="6" y1="4" x2="6" y2="12" />
      <line x1="9" y1="4" x2="9" y2="12" />
      <circle cx="7.5" cy="8" r="1" />
    </svg>
  );
}

export function VramIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <line x1="3" y1="6.5" x2="13" y2="6.5" />
      <line x1="3" y1="9.5" x2="13" y2="9.5" />
      <circle cx="5.5" cy="11" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="11" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
