'use client';

import { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  variant?: 'default' | 'subtle' | 'elevated' | 'card';
  className?: string;
  as?: 'div' | 'section' | 'aside' | 'nav';
  onClick?: () => void;
}

const variantClasses: Record<string, string> = {
  default: 'glass-panel',
  subtle: 'glass-panel-subtle',
  elevated: 'glass-panel-elevated',
  card: 'glass-card',
};

export function GlassPanel({
  children,
  variant = 'default',
  className = '',
  as: Component = 'div',
  onClick,
}: GlassPanelProps) {
  return (
    <Component
      className={`${variantClasses[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}
