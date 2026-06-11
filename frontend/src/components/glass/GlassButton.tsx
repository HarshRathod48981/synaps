'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'ghost' | 'filled' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export function GlassButton({
  children,
  variant = 'ghost',
  size = 'md',
  active = false,
  className = '',
  ...props
}: GlassButtonProps) {
  const sizeClasses = {
    sm: 'p-1.5 rounded-lg',
    md: 'p-2 rounded-xl',
    lg: 'p-2.5 rounded-xl',
  };

  const variantClasses = {
    ghost: `${active
      ? 'bg-[var(--glass-bg-active)] text-[var(--text-primary)]'
      : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
    }`,
    filled: `glass-panel ${active
      ? 'bg-[var(--glass-bg-active)]'
      : 'hover:bg-[var(--glass-bg-hover)]'
    } text-[var(--text-primary)]`,
    accent: 'btn-accent',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center transition-all duration-200
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
