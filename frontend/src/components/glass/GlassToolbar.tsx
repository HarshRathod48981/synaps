'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlassToolbarProps {
  children: ReactNode;
  visible?: boolean;
  className?: string;
}

export function GlassToolbar({
  children,
  visible = true,
  className = '',
}: GlassToolbarProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`floating-toolbar glass-panel-toolbar ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ToolbarButtonProps {
  icon: ReactNode;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  className?: string;
}

export function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
  danger = false,
  className = '',
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        relative flex items-center justify-center w-9 h-9 rounded-full
        transition-all duration-200 group
        ${active
          ? 'bg-[var(--accent-muted)] text-[var(--accent-light)]'
          : danger
            ? 'text-[var(--text-tertiary)] hover:bg-red-500/15 hover:text-red-400'
            : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
        }
        ${className}
      `}
    >
      {icon}
    </button>
  );
}

export function ToolbarDivider() {
  return (
    <div className="w-px h-5 mx-1 bg-[var(--glass-border)]" />
  );
}
