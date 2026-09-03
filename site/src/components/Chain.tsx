import type { ReactNode } from 'react';
import styles from './Chain.module.css';

export interface ChainLink {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}

export interface ChainProps {
  links: ChainLink[];
  arrow?: string;
}

export function Chain({ links, arrow = '▶' }: ChainProps) {
  return (
    <div className={styles.chain}>
      {links.map((link, i) => (
        <ChainStep key={i} link={link} isLast={i === links.length - 1} arrow={arrow} />
      ))}
    </div>
  );
}

function ChainStep({ link, isLast, arrow }: { link: ChainLink; isLast: boolean; arrow: string }) {
  return (
    <>
      <div className={styles.link}>
        <div className={styles.lbl}>{link.label}</div>
        <div className={styles.val}>{link.value}</div>
        {link.detail && <div className={styles.detail}>{link.detail}</div>}
      </div>
      {!isLast && <div className={styles.arr}>{arrow}</div>}
    </>
  );
}
