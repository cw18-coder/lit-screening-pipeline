import { useEffect } from 'react';
import { Chip } from './Chip';
import type { AbstractRecord } from '../types/prisma';
import styles from './AbstractDrawer.module.css';

export interface AbstractDrawerProps {
  record: AbstractRecord | null;
  onClose: () => void;
}

export function AbstractDrawer({ record, onClose }: AbstractDrawerProps) {
  useEffect(() => {
    if (!record) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [record, onClose]);

  if (!record) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Abstract detail">
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.meta}>
            <Chip variant="accent" mono>{record.stable_id}</Chip>
            <Chip mono>{record.year}</Chip>
            {record.abstract_src && (
              <Chip variant={record.abstract_src === 'manual' ? 'warn' : 'good'}>
                src: {record.abstract_src}
              </Chip>
            )}
          </div>
          <button className={styles.close} onClick={onClose} title="Close (Esc)" aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          <h2 className={styles.title}>{record.title || '(no title)'}</h2>
          <p className={styles.authors}>{record.authors_apa}</p>
          {record.doi_url && (
            <p className={styles.doi}>
              <a href={record.doi_url} target="_blank" rel="noopener noreferrer">
                {record.doi_url.replace(/^https?:\/\/(dx\.)?doi\.org\//, 'doi:')}
              </a>
            </p>
          )}
          <h3 className={styles.section}>Abstract</h3>
          <p className={styles.abstract}>{record.abstract_text || '(no abstract text captured)'}</p>
        </div>
      </div>
    </div>
  );
}
