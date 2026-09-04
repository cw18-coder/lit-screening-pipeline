import { Link } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { useJson } from '../hooks/useJson';
import type { WikiIndex, WikiPage as WikiPageMeta } from '../types/prisma';
import styles from './Wiki.module.css';

const SECTION_LABELS: Record<string, string> = {
  root: 'Root',
  agents: 'Agents',
  skills: 'Skills',
  instructions: 'Instructions',
};

const SECTION_ORDER = ['root', 'agents', 'skills', 'instructions'];

export function Wiki() {
  const { data, loading, error } = useJson<WikiIndex>('wiki-index.json');

  if (loading) return <div className="route-view">Loading the wiki index…</div>;
  if (error) {
    return (
      <div className="route-view">
        <Callout variant="accent-2" title="Failed to load wiki index.">
          {error.message}
        </Callout>
      </div>
    );
  }
  if (!data) return null;

  const sections = [...data.sections].sort(
    (a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section),
  );

  return (
    <div className="route-view">
      <h1>.github/ wiki</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '82ch' }}>
        Browsable rendering of the skills, agents, instructions, and root docs that govern the
        workspace. Every page corresponds to a source file under <code>.github/</code> in the
        thesis repository; use the section links below to navigate.
      </p>

      {sections.map(section => (
        <section key={section.section} className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {SECTION_LABELS[section.section] ?? section.label}
            </h2>
            <Chip variant="accent">{section.pages.length} page{section.pages.length === 1 ? '' : 's'}</Chip>
          </div>
          <div className={styles.cardGrid}>
            {section.pages.map(page => (
              <PageCard key={page.page_id} section={section.section} page={page} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PageCard({ section, page }: { section: string; page: Pick<WikiPageMeta, 'page_id' | 'title' | 'description'> }) {
  return (
    <Card>
      <h3 className={styles.cardTitle}>
        <Link to={`/wiki/${section}/${page.page_id}`}>{page.title}</Link>
      </h3>
      {page.description && (
        <p className={styles.cardDescription}>{page.description}</p>
      )}
    </Card>
  );
}
