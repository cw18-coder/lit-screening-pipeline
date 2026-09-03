import type { ReactNode } from 'react';
import styles from './Callout.module.css';

export interface CalloutProps {
  children: ReactNode;
  variant?: 'accent' | 'accent-2';
  title?: ReactNode;
}

export function Callout({ children, variant = 'accent-2', title }: CalloutProps) {
  return (
    <div className={`${styles.callout} ${styles[variant]}`}>
      {title && <b>{title}</b>} {children}
    </div>
  );
}
