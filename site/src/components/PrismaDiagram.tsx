import type { PrismaTallyNode } from '../types/prisma';
import { FlowNode } from './FlowNode';
import styles from './PrismaDiagram.module.css';

// Layout constants
const NODE_W = 240;
const NODE_H = 88;
const V_GAP = 30;
const COL_GAP = 60;
const CANVAS_PAD = 20;

interface Placed {
  node: PrismaTallyNode;
  col: 'track1' | 'track2' | 'combined';
  row: number;
}

// Node → column + row layout. Explicit to keep the diagram readable.
const LAYOUT: Record<string, { col: 'track1' | 'track2' | 'combined'; row: number }> = {
  identification_records_track1:                { col: 'track1', row: 0 },
  identification_duplicates_removed_track1:     { col: 'track1', row: 1 },
  identification_optional_queries_removed_track1: { col: 'track1', row: 2 },
  identification_unique_records_track1:         { col: 'track1', row: 3 },
  screening_records_input_track1:               { col: 'track1', row: 4 },
  screening_excluded_title_abstract_track1:     { col: 'track1', row: 5 },
  screening_records_pending_track1:             { col: 'track1', row: 6 },
  eligibility_sought_full_text_track1:          { col: 'track1', row: 7 },
  eligibility_not_retrieved_track1:             { col: 'track1', row: 8 },
  eligibility_assessed_full_text_track1:        { col: 'track1', row: 9 },
  eligibility_excluded_full_text_track1:        { col: 'track1', row: 10 },
  included_studies_track1:                      { col: 'track1', row: 11 },

  identification_records_track2:                { col: 'track2', row: 0 },
  cross_track_overlaps:                         { col: 'track2', row: 1 },
  included_studies_track2:                      { col: 'track2', row: 11 },

  included_studies_total:                       { col: 'combined', row: 12 },
};

const COLUMN_X: Record<Placed['col'], number> = {
  track1:   CANVAS_PAD,
  track2:   CANVAS_PAD + NODE_W + COL_GAP,
  combined: CANVAS_PAD + (NODE_W + COL_GAP) / 2,
};

function rowY(row: number): number {
  return CANVAS_PAD + row * (NODE_H + V_GAP);
}

export interface PrismaDiagramProps {
  nodes: PrismaTallyNode[];
}

export function PrismaDiagram({ nodes }: PrismaDiagramProps) {
  const placed: Placed[] = nodes
    .map(n => {
      const p = LAYOUT[n.node_id];
      return p ? { node: n, ...p } : null;
    })
    .filter((x): x is Placed => x !== null);

  const canvasW = CANVAS_PAD * 2 + NODE_W * 2 + COL_GAP;
  const maxRow = placed.reduce((m, p) => Math.max(m, p.row), 0);
  const canvasH = CANVAS_PAD * 2 + (maxRow + 1) * (NODE_H + V_GAP);

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        className={styles.svg}
        role="img"
        aria-label="PRISMA identification and screening funnel"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edge-stroke)" />
          </marker>
        </defs>

        {/* Column headers */}
        <text x={COLUMN_X.track1 + NODE_W / 2} y={12} className={styles.colHdr} textAnchor="middle">
          Track 1 · Consensus queries
        </text>
        <text x={COLUMN_X.track2 + NODE_W / 2} y={12} className={styles.colHdr} textAnchor="middle">
          Track 2 · Purposive anchors
        </text>

        {/* Nodes */}
        {placed.map(p => (
          <FlowNode
            key={p.node.node_id}
            node={p.node}
            x={COLUMN_X[p.col]}
            y={rowY(p.row)}
            width={NODE_W}
            height={NODE_H}
          />
        ))}

        {/* Edges (deterministic, per LAYOUT) */}
        {edgesFor(placed).map((e, i) => (
          <FlowEdge key={i} {...e} />
        ))}
      </svg>
    </div>
  );
}

interface EdgeSpec {
  from: Placed;
  to: Placed;
  label?: string;
}

function edgesFor(placed: Placed[]): EdgeSpec[] {
  const byId = Object.fromEntries(placed.map(p => [p.node.node_id, p]));
  const pairs: Array<[string, string, string?]> = [
    // Track 1 vertical spine
    ['identification_records_track1', 'identification_duplicates_removed_track1'],
    ['identification_duplicates_removed_track1', 'identification_optional_queries_removed_track1'],
    ['identification_optional_queries_removed_track1', 'identification_unique_records_track1'],
    ['identification_unique_records_track1', 'screening_records_input_track1'],
    ['screening_records_input_track1', 'screening_excluded_title_abstract_track1'],
    ['screening_records_input_track1', 'screening_records_pending_track1'],
    ['screening_records_pending_track1', 'eligibility_sought_full_text_track1'],
    ['eligibility_sought_full_text_track1', 'eligibility_not_retrieved_track1'],
    ['eligibility_sought_full_text_track1', 'eligibility_assessed_full_text_track1'],
    ['eligibility_assessed_full_text_track1', 'eligibility_excluded_full_text_track1'],
    ['eligibility_assessed_full_text_track1', 'included_studies_track1'],
    // Track 2 spine
    ['identification_records_track2', 'cross_track_overlaps'],
    ['cross_track_overlaps', 'included_studies_track2'],
    // Combined
    ['included_studies_track1', 'included_studies_total'],
    ['included_studies_track2', 'included_studies_total'],
  ];
  return pairs
    .map(([from, to]) => {
      const f = byId[from];
      const t = byId[to];
      if (!f || !t) return null;
      return { from: f, to: t };
    })
    .filter((e): e is EdgeSpec => e !== null);
}

function FlowEdge({ from, to }: EdgeSpec) {
  const fx = COLUMN_X[from.col] + NODE_W / 2;
  const fy = rowY(from.row) + NODE_H;
  const tx = COLUMN_X[to.col] + NODE_W / 2;
  const ty = rowY(to.row);

  const midY = (fy + ty) / 2;
  const d =
    from.col === to.col
      ? `M ${fx} ${fy} L ${fx} ${ty}`
      : `M ${fx} ${fy} L ${fx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;

  return (
    <path
      d={d}
      className={styles.edge}
      fill="none"
      markerEnd="url(#arrow)"
    />
  );
}
