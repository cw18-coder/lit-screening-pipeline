import type { ReactNode } from 'react';
import styles from './Chip.module.css';

export type ChipVariant = 'neutral' | 'accent' | 'good' | 'warn';

export interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
  mono?: boolean;
  title?: string;
}

export function Chip({ children, variant = 'neutral', mono = false, title }: ChipProps) {
  const cls = [styles.chip, styles[variant], mono ? styles.mono : ''].filter(Boolean).join(' ');
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}
