import type { ReactNode } from 'react';
import styles from './Details.module.css';

export interface DetailsProps {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
}

export function Details({ summary, children, open }: DetailsProps) {
  return (
    <details className={styles.details} open={open}>
      <summary className={styles.summary}>{summary}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
