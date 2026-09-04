import { Link, useParams } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { Chip } from '../components/Chip';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useJson } from '../hooks/useJson';
import type { WikiPage as WikiPageMeta } from '../types/prisma';
import styles from './WikiPage.module.css';

const SECTION_LABELS: Record<string, string> = {
  root: 'Root',
  agents: 'Agents',
  skills: 'Skills',
  instructions: 'Instructions',
};

export function WikiPage() {
  const { section, pageId } = useParams<{ section: string; pageId: string }>();
  const path = section && pageId ? `wiki-pages/${pageId}.json` : '';
  const { data, loading, error } = useJson<WikiPageMeta>(path);

  if (!section || !pageId) {
    return (
      <div className="route-view">
        <BackLink />
        <h1>Missing wiki page identifier.</h1>
      </div>
    );
  }
  if (loading) return <div className="route-view">Loading page…</div>;
  if (error) {
    return (
      <div className="route-view">
        <BackLink />
        <Callout variant="warn" title={`Failed to load ${pageId}.`}>
          {error.message}
        </Callout>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="route-view">
      <BackLink />
      <div className={styles.header}>
        <div className={styles.meta}>
          <Chip variant="accent">{SECTION_LABELS[data.section] ?? data.section}</Chip>
          {data.applies_to && (
            <Chip variant="neutral" mono title="File-glob scope">
              {data.applies_to}
            </Chip>
          )}
        </div>
        <h1 className={styles.title}>{data.title}</h1>
        {data.description && <p className={styles.description}>{data.description}</p>}
      </div>

      <ScreeningFlowSlot pageId={data.page_id} />

      <MarkdownRenderer source={data.body_md} className={styles.body} />

      {data.outbound_links && data.outbound_links.length > 0 && (
        <section className={styles.linksBlock}>
          <h3 className={styles.linksHeading}>Outbound links</h3>
          <ul className={styles.linksList}>
            {data.outbound_links.map(link => (
              <li key={link}><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <p className={styles.back}>
      <Link to="/wiki">← Back to wiki index</Link>
    </p>
  );
}

// Reserved slot: the ai-assisted-screening page will render an interactive
// ReactFlow diagram of sample-size -> Bayesian priors -> residuals in a
// follow-up commit. For now, other pages render nothing here.
function ScreeningFlowSlot({ pageId }: { pageId: string }) {
  if (pageId !== 'skill-ai-assisted-screening') return null;
  return (
    <Callout variant="accent" title="Interactive flow diagram coming next.">
      {' '}This page will host a clickable diagram of the screening workflow: n = 126 stratified
      sample, per-query Bayesian priors, similarity triage propagation at posterior threshold
      0.70, and the 39-record residual pass. See the version-history table below for the current
      state.
    </Callout>
  );
}
