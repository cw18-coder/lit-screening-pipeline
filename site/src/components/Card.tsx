import type { ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  className?: string;
}

export function Card({ children, title, className }: CardProps) {
  return (
    <section className={`${styles.card} ${className ?? ''}`}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </section>
  );
}
