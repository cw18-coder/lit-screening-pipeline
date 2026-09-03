import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './RowTable.module.css';

export interface RowTableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  width?: string;
}

export interface RowTableProps<T> {
  rows: T[];
  columns: RowTableColumn<T>[];
  searchFields?: Array<keyof T | string>;
  pageSize?: number;
  initialSort?: [string, 'asc' | 'desc'];
  rowKey?: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc';

export function RowTable<T>(props: RowTableProps<T>) {
  const {
    rows,
    columns,
    searchFields = [],
    pageSize = 25,
    initialSort,
    rowKey,
    onRowClick,
    emptyMessage = 'No rows match the current filter.',
  } = props;

  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.[0] ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initialSort?.[1] ?? 'asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [q, sortKey, sortDir]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || searchFields.length === 0) return rows;
    return rows.filter(r =>
      searchFields.some(k => {
        const v = getField(r, k as string);
        return v != null && String(v).toLowerCase().includes(needle);
      })
    );
  }, [rows, q, searchFields]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = getField(a, sortKey);
      const vb = getField(b, sortKey);
      const cmp = compareValues(va, vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageRows = sorted.slice(pageStart, pageStart + pageSize);

  const toggleSort = (col: RowTableColumn<T>) => {
    if (col.sortable === false) return;
    const k = String(col.key);
    if (sortKey === k) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const defaultKey = (r: T, i: number) => {
    const rec = r as unknown as { sample_id?: string; stable_id?: string };
    return rec.sample_id ?? rec.stable_id ?? String(pageStart + i);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {searchFields.length > 0 && (
          <input
            className={styles.search}
            type="search"
            placeholder="Filter this table…"
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Filter table"
          />
        )}
        <div className={styles.count}>
          {sorted.length === rows.length
            ? `${rows.length} row${rows.length === 1 ? '' : 's'}`
            : `${sorted.length} of ${rows.length}`}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map(col => {
                const k = String(col.key);
                const active = sortKey === k;
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={k}
                    className={`${col.className ?? ''} ${sortable ? styles.sortable : ''}`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={sortable ? () => toggleSort(col) : undefined}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {col.label}
                    {active && <span className={styles.sortArrow}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr
                  key={(rowKey ?? defaultKey)(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? styles.clickable : undefined}
                >
                  {columns.map(col => (
                    <td key={String(col.key)} className={col.className}>
                      {col.render ? col.render(row) : renderCell(getField(row, String(col.key)))}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pager}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function getField(row: unknown, key: string): unknown {
  if (row == null || typeof row !== 'object') return undefined;
  return (row as Record<string, unknown>)[key];
}

function renderCell(v: unknown): ReactNode {
  if (v == null || v === '') return <span className={styles.dim}>—</span>;
  if (typeof v === 'string' && /^https?:\/\//.test(v)) {
    return (
      <a href={v} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {v.replace(/^https?:\/\/(dx\.)?doi\.org\//, 'doi:')}
      </a>
    );
  }
  return String(v);
}

function compareValues(a: unknown, b: unknown): number {
  const aNil = a == null || a === '';
  const bNil = b == null || b === '';
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}
