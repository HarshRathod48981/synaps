'use client';

import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

interface SegmentOption {
  key: string;
  label: string;
}

interface GlassSegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function GlassSegmentedControl({
  options,
  value,
  onChange,
  className = '',
}: GlassSegmentedControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeIndex = options.findIndex((o) => o.key === value);
    const items = containerRef.current.querySelectorAll('[data-segment-item]');
    if (items[activeIndex]) {
      const el = items[activeIndex] as HTMLElement;
      setIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    }
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      className={`segmented-control relative ${className}`}
    >
      {/* Sliding indicator */}
      <motion.div
        className="segmented-control-indicator"
        layoutId="segment-indicator"
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        style={{
          top: 3,
          bottom: 3,
        }}
      />

      {options.map((option) => (
        <button
          key={option.key}
          data-segment-item
          data-active={value === option.key ? 'true' : 'false'}
          className="segmented-control-item"
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
