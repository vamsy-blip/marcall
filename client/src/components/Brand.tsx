import { cn } from '@/lib/utils';

export function MarcallLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="MARCALL"
      data-testid="logo-MARCALL"
    >
      <path
        d="M9 18 C9 13, 13 10, 17 10 C21 10, 24 13, 24 17 L24 19 L18 19 L18 23 L13 23 C10.7909 23, 9 21.2091, 9 19 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="14" cy="16" r="0.9" fill="currentColor" />
      <circle cx="17" cy="16" r="0.9" fill="currentColor" />
      <circle cx="20" cy="16" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function MarcallWordmark({ className, size = 28, accent = true }: { className?: string; size?: number; accent?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display font-bold tracking-tight', className)}>
      <MarcallLogo size={size} className={accent ? 'text-primary' : ''} />
      <span style={{ fontSize: size * 0.72 }}>MARCALL</span>
    </span>
  );
}
