import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Callout } from '../components/Callout';
import { Chain } from '../components/Chain';
import { Chip } from '../components/Chip';
import { Stat } from '../components/Stat';
import { useJson } from '../hooks/useJson';
import type { PrismaTallyNode, SiteMeta } from '../types/prisma';
import styles from './Home.module.css';

const TOP_LEVEL_NODE_IDS = [
  'identification_records_track1',
  'identification_unique_records_track1',
  'screening_records_input_track1',
  'included_studies_track2',
];

export function Home() {
  const { data: tally, loading } = useJson<PrismaTallyNode[]>('prisma-tally.json');
  const { data: meta } = useJson<SiteMeta>('meta.json');

  if (loading || !tally) {
    return <div className="route-view">Loading tally…</div>;
  }

  const byId = Object.fromEntries(tally.map(n => [n.node_id, n]));
  const links = TOP_LEVEL_NODE_IDS.map(id => byId[id]).filter(Boolean).map(n => ({
    label: n.label,
    value: n.count ?? 'TBD',
    detail: n.source_log,
  }));

  const uniqueT1 = byId['identification_unique_records_track1']?.count;
  const activeT1 = byId['screening_records_input_track1']?.count;
  const track2 = byId['included_studies_track2']?.count;

  return (
    <div className="route-view">
      <div className={styles.hero}>
        <span className={styles.tag}>PRISMA · Correctness-wedge · interactive</span>
        <h1>Correctness-wedge review of AI-assisted software development</h1>
        <p>
          Interactive PRISMA identification and screening funnel plus a browsable rendering of
          the <code>.github/</code> workspace that governs the review. Every number here matches
          the corresponding count reported in the thesis methodology chapter and appendix.
        </p>
        <div className={styles.sub}>
          Snapshot {meta?.snapshot_date ?? '—'} · release v{meta?.release_version ?? '—'}
          {meta?.labels_frozen === false && (
            <> · <Chip variant="warn">labels not yet frozen</Chip></>
          )}
        </div>
      </div>

      <h2>Snapshot at a glance</h2>
      <Chain links={links} />

      <h2>Key totals</h2>
      <div className={styles.stats}>
        <Stat
          value={uniqueT1 ?? '—'}
          label="Unique Track 1 references after dedup"
          detail="01c active"
        />
        <Stat
          value={activeT1 ?? '—'}
          label="Records entering title-abstract screening"
          detail="post-Q15 removal, post-Track-2 overlap"
          variant="accent"
        />
        <Stat
          value={track2 ?? '—'}
          label="Track 2 anchors (purposively selected)"
          detail="01b active"
          variant="good"
        />
      </div>

      <h2>Explore</h2>
      <div className={styles.quicklinks}>
        <Card title={<><Chip variant="accent">1</Chip> PRISMA flow</>}>
          <p>Interactive funnel diagram with drill-down tables for every node.</p>
          <p><Link to="/prisma">Open PRISMA →</Link></p>
        </Card>
        <Card title={<><Chip variant="accent">2</Chip> Workspace wiki</>}>
          <p>Skills, instructions, agents, and the top-level Copilot brief that govern the review.</p>
          <p><Link to="/wiki">Open wiki →</Link></p>
        </Card>
        <Card title={<><Chip variant="accent">3</Chip> About &amp; cite</>}>
          <p>Release metadata, ORCID, Zenodo DOI, and citation strings for reuse.</p>
          <p><Link to="/about">Open about →</Link></p>
        </Card>
      </div>

      <Callout variant="accent" title="Alignment principle.">
        The site is the interactive verification layer for the same PRISMA process reported in the
        static thesis. If a count on the site does not match the appendix, it is a defect — the
        site is the arbiter of what the underlying data supports.
      </Callout>
    </div>
  );
}
