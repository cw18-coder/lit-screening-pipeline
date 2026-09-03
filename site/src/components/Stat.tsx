import type { ReactNode } from 'react';
import styles from './Stat.module.css';

export interface StatProps {
  value: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  variant?: 'accent' | 'accent-2' | 'good' | 'warn';
}

export function Stat({ value, label, detail, variant = 'accent-2' }: StatProps) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.n} ${styles[variant]}`}>{value}</div>
      <div className={styles.l}>{label}</div>
      {detail && <div className={styles.d}>{detail}</div>}
    </div>
  );
}
