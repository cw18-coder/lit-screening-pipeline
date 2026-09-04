import { useEffect, useState } from 'react';
import { Chip } from './Chip';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { AbstractRecord } from '../types/prisma';
import styles from './AbstractDrawer.module.css';

const ABSTRACT_TRUNCATE = 800;

export interface ExclusionInfo {
  code: string;
  codeLabel: string;
  codeDescription: string;
  source: string;
  comment: string;
}

export interface AbstractDrawerProps {
  record: AbstractRecord | null;
  onClose: () => void;
  exclusionInfo?: ExclusionInfo;
}

export function AbstractDrawer({ record, onClose, exclusionInfo }: AbstractDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!record) return;
    setExpanded(false);
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

  const abstract = record.abstract_text || '';
  const shouldTruncate = abstract.length > ABSTRACT_TRUNCATE;
  const displayedAbstract = shouldTruncate && !expanded
    ? abstract.slice(0, ABSTRACT_TRUNCATE).replace(/\s+\S*$/, '') + '…'
    : abstract;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Abstract detail">
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.meta}>
            {exclusionInfo && <Chip variant="accent">{exclusionInfo.code}</Chip>}
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
          {abstract ? (
            <>
              <MarkdownRenderer source={displayedAbstract} />
              {shouldTruncate && (
                <button
                  type="button"
                  className={styles.expandBtn}
                  onClick={() => setExpanded(v => !v)}
                >
                  {expanded ? 'Show less' : 'Show more…'}
                </button>
              )}
            </>
          ) : (
            <p className={styles.abstract}>(no abstract text captured for this record)</p>
          )}

          {exclusionInfo && (
            <section className={styles.exclusionPanel}>
              <h3 className={styles.section}>Exclusion reason</h3>
              <div className={styles.exclusionHeader}>
                <Chip variant="accent">{exclusionInfo.code}</Chip>
                <strong>{exclusionInfo.codeLabel}</strong>
              </div>
              <p className={styles.exclusionDescription}>{exclusionInfo.codeDescription}</p>
              <div className={styles.exclusionSourceRow}>
                <Chip variant={exclusionInfo.source.startsWith('ai_') ? 'warn' : 'accent'}>
                  {formatSource(exclusionInfo.source)}
                </Chip>
              </div>
              {exclusionInfo.comment && (
                <>
                  <h4 className={styles.subheading}>Reviewer note</h4>
                  <p className={styles.comment}>{exclusionInfo.comment}</p>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSource(source: string): string {
  if (source.startsWith('human_S')) return `Hand-labelled seed (${source.slice(6)})`;
  if (source.startsWith('human_R')) return `Hand-labelled residual (${source.slice(6)})`;
  if (source.startsWith('human_')) return `Reviewer decision (${source.slice(6)})`;
  if (source === 'ai_similarity') return 'AI-propagated by Bayesian similarity triage';
  return source;
}
