import { Barchart } from '../components/Barchart';
import { Callout } from '../components/Callout';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { PrismaDiagram } from '../components/PrismaDiagram';
import { useJson } from '../hooks/useJson';
import type { ConsensusQuestion, PrismaTallyNode } from '../types/prisma';

export function Prisma() {
  const { data: tally, loading } = useJson<PrismaTallyNode[]>('prisma-tally.json');
  const { data: questions } = useJson<ConsensusQuestion[]>('questions.json');

  if (loading || !tally) {
    return <div className="route-view">Loading tally…</div>;
  }

  const barRows = (questions ?? [])
    .filter(q => q.operationalised !== false)
    .map(q => ({
      label: q.q_id,
      value: q.results_returned ?? 0,
      detail: `${q.q_id}: ${q.results_returned} results, ${q.unique_track1_hits} unique Track 1 hits`,
    }));

  return (
    <div className="route-view">
      <h1>PRISMA identification and screening funnel</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '78ch' }}>
        Interactive rendering of the correctness-wedge review funnel. Every node is clickable —
        selecting one opens the drill-down page with the underlying references, exclusion reasons,
        or decision markdowns.
      </p>

      <div style={{ margin: '12px 0' }}>
        <Chip variant="accent">Track 1: Consensus queries</Chip>
        <Chip variant="good">Track 2: Purposive anchors</Chip>
        <Chip variant="warn">Screening exclusions</Chip>
        <Chip>Eligibility and included nodes populate later</Chip>
      </div>

      <PrismaDiagram nodes={tally} />

      <h2>Records returned per Consensus query</h2>
      {barRows.length > 0 ? (
        <Card>
          <Barchart rows={barRows} />
        </Card>
      ) : (
        <Callout>
          Question metadata not yet available for this snapshot. Rebuild the site with{' '}
          <code>pnpm build:data</code> once the questions JSON is present.
        </Callout>
      )}

      <Callout variant="accent" title="Pre-screening removals.">
        {' '}The <b>optional-queries-removed</b> and <b>cross-track overlaps</b> nodes sit between
        identification and screening. They are PRISMA 2020 "records removed before screening" per
        Figure 2 — click each to see the underlying rows.
      </Callout>
    </div>
  );
}
