import styles from './Barchart.module.css';

export interface BarchartRow {
  label: string;
  value: number;
  detail?: string;
}

export interface BarchartProps {
  rows: BarchartRow[];
  max?: number;
  formatValue?: (v: number) => string;
}

export function Barchart({ rows, max, formatValue = String }: BarchartProps) {
  const cap = max ?? Math.max(1, ...rows.map(r => r.value));
  return (
    <div className={styles.barchart}>
      {rows.map((r, i) => {
        const pct = Math.min(100, Math.round((r.value / cap) * 100));
        return (
          <div className={styles.row} key={i} title={r.detail ?? `${r.label}: ${r.value}`}>
            <div className={styles.label}>{r.label}</div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.value}>{formatValue(r.value)}</div>
          </div>
        );
      })}
    </div>
  );
}
