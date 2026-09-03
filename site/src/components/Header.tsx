import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Header.module.css';

const THEME_KEY = 'esgci-theme';
const TABS: Array<{ label: string; to: string; end?: boolean; digit: number }> = [
  { label: 'Overview', to: '/', end: true, digit: 1 },
  { label: 'PRISMA', to: '/prisma', digit: 2 },
  { label: 'Wiki', to: '/wiki', digit: 3 },
  { label: 'Search', to: '/search', digit: 4 },
  { label: 'About', to: '/about', digit: 5 },
];

function readTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function Header() {
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* localStorage may be blocked in some contexts */
    }
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
      const idx = parseInt(e.key, 10);
      const target = TABS.find(t => t.digit === idx);
      if (target) {
        window.location.hash = `#${target.to}`;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const flipTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <header className="top">
      <div className={styles.inner}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <span className={styles.logo}>Cw</span>
            <div>
              <div>Correctness-wedge review</div>
              <small>PRISMA funnel · .github/ wiki</small>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.theme} onClick={flipTheme} title="Toggle theme" type="button">
              {theme === 'dark' ? '☾' : '☀'} Theme
            </button>
          </div>
        </div>
        <nav className={styles.tabs} aria-label="Primary">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `${styles.tab} ${isActive ? styles.active : ''}`
              }
              title={`Alt-${tab.digit}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
