import { Link } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { Card } from '../components/Card';
import { PrismaDiagram } from '../components/PrismaDiagram';
import { useJson } from '../hooks/useJson';
import type { PrismaTallyNode } from '../types/prisma';

export function Prisma() {
  const { data: tally, loading } = useJson<PrismaTallyNode[]>('prisma-tally.json');

  if (loading || !tally) {
    return <div className="route-view">Loading the funnel…</div>;
  }

  return (
    <div className="route-view">
      <h1>Identification and screening funnel</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '82ch' }}>
        Each box is a stage in the PRISMA 2020 flow. Boxes with a coloured banner along the top
        edge are clickable — they reveal the underlying references, exclusion reasons, or anchor
        rationales. Transit boxes (dimmer) carry a summary count forward and have no additional
        drill-down of their own.
      </p>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '82ch' }}>
        Track 1 records are identified through Consensus.app queries. Track 2 records are
        purposively selected anchors that carry theoretical or methodological weight. Where a
        Track 1 hit and a Track 2 anchor point at the same reference the record is attributed to
        Track 2 and bypasses title-and-abstract screening.
      </p>

      <PrismaDiagram nodes={tally} />

      <Callout variant="accent" title="Reading the diagram.">
        {' '}Pan by dragging, zoom with the controls in the bottom-right, and press Enter with a
        node focused to open its drill-down.
      </Callout>

      <h2 style={{ marginTop: 32 }}>Non-PRISMA logs</h2>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '82ch' }}>
        References cited alongside the review but sitting outside the PRISMA funnel. Recorded here
        as separate logs so the final reference list can be assembled without ambiguity.
      </p>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Card>
          <h3>Chapter 3 methodology anchors</h3>
          <p style={{ color: 'var(--ink-dim)' }}>Identification-strategy literature — quasi-experimental design references.</p>
          <p><Link to="/logs/ch3-methods-anchors">Open →</Link></p>
        </Card>
        <Card>
          <h3>Signpost citations</h3>
          <p style={{ color: 'var(--ink-dim)' }}>Framing, definitions, method precedents cited in the narrative.</p>
          <p><Link to="/logs/signpost-citations">Open →</Link></p>
        </Card>
      </div>
    </div>
  );
}
