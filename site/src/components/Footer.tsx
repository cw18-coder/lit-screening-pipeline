import { useJson } from '../hooks/useJson';
import type { SiteMeta } from '../types/prisma';
import styles from './Footer.module.css';

export function Footer() {
  const { data: meta } = useJson<SiteMeta>('meta.json');

  return (
    <footer className={styles.foot}>
      <div className={styles.inner}>
        <div>
          <b>Release</b>{' '}
          <span className={styles.mono}>v{meta?.release_version ?? '—'}</span>{' '}
          · snapshot {meta?.snapshot_date ?? '—'}
        </div>
        <div>
          {meta?.zenodo_doi && (
            <a
              href={`https://doi.org/${meta.zenodo_doi}`}
              target="_blank"
              rel="noopener"
            >
              DOI {meta.zenodo_doi}
            </a>
          )}
          {meta?.orcid_id && (
            <>
              {' · '}
              <a
                href={`https://orcid.org/${meta.orcid_id}`}
                target="_blank"
                rel="noopener"
              >
                ORCID {meta.orcid_id}
              </a>
            </>
          )}
          {meta?.repo_url && (
            <>
              {' · '}
              <a href={meta.repo_url} target="_blank" rel="noopener">
                Source
              </a>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
