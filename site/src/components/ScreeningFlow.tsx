import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Chip } from './Chip';
import styles from './ScreeningFlow.module.css';

// Static narrative: five stages of the screening workflow. Each node carries a
// human-readable summary and a details block that opens in a side drawer when
// the reader clicks it.
export interface ScreeningStage {
  id: string;
  label: string;
  count: string;
  role: 'pool' | 'sample' | 'triage' | 'residual' | 'final';
  summary: string;
  details: string[];
}

const STAGES: ScreeningStage[] = [
  {
    id: 'pool',
    label: 'Active identification pool',
    count: '307',
    role: 'pool',
    summary: 'Unique records after deduplication and the Q15 stand-down (see PRISMA node 7).',
    details: [
      'Track 1 records from Consensus.app queries after intra-Track-1 dedup.',
      '20 Q15 records marked ignored_optional_q15 in 01a, 01c, and 2b.',
      '5 cross-track overlaps attributed to Track 2 and removed from screening input.',
      'Effective screening pool: 307 records.',
    ],
  },
  {
    id: 'power',
    label: 'Power analysis',
    count: 'n = 126',
    role: 'sample',
    summary: 'Sample size chosen to bound the sensitivity confidence interval at half-width ≤ 0.075.',
    details: [
      'scipy-verified across four framings: sensitivity CI, specificity CI, Cohen κ, McNemar.',
      'α = 0.05, 1 − β = 0.80, prevalence assumed 0.30, finite-population correction against 307.',
      'n = 126 clears the specificity and κ targets, sits one short of the sensitivity target.',
      'Balanced allocation: 21 non-Q15 primary-query strata × k = 6 per stratum.',
    ],
  },
  {
    id: 'seed',
    label: 'Stratified seed sample',
    count: '126 hand-labelled',
    role: 'sample',
    summary: 'Reviewer decisions become the ground truth prior for the Bayesian triage.',
    details: [
      'Seed 20260903 (skill birth date); pool fingerprint 17ca7c8e1033d9e6.',
      '44 includes and 82 excludes captured in human_decisions.csv.',
      'Rubric v1.1.0 at capture time; every reviewer comment preserved verbatim.',
      'Session S001..S126 in the labelling UI.',
    ],
  },
  {
    id: 'prior',
    label: 'Per-query priors',
    count: 'Laplace α = 1',
    role: 'triage',
    summary: 'Per-query exclusion prevalence, Laplace-smoothed against small strata.',
    details: [
      'π_q = (n_exclude_q + α) / (n_labelled_q + 2α) computed over the 126 seed labels.',
      'Applied per primary Consensus query so a stratum-specific base rate anchors each record.',
    ],
  },
  {
    id: 'likelihood',
    label: 'SPECTER cosine likelihood',
    count: 'β = 30',
    role: 'triage',
    summary: 'Similarity of each unlabelled record to labelled include vs exclude neighbours.',
    details: [
      'SPECTER1 embeddings persisted in ChromaDB, one collection per primary query.',
      'Per-record signal: max cosine(x, labelled_excludes) − max cosine(x, labelled_includes).',
      'Scaled by β = 30 in log-odds space before combining with the per-query prior.',
    ],
  },
  {
    id: 'posterior',
    label: 'Posterior + thresholds',
    count: '0.70 / 0.30',
    role: 'triage',
    summary: 'Fixed uncertainty band gates auto-propagation.',
    details: [
      'logit P(exclude | x, q) = logit π_q + β × (sim_exc − sim_inc).',
      'Posterior > 0.70 → propagate as exclude; posterior < 0.30 → propagate as include.',
      'Records with posterior in [0.30, 0.70] land in the residual pass for human review.',
    ],
  },
  {
    id: 'propagated',
    label: 'Auto-propagated',
    count: '142',
    role: 'triage',
    summary: '105 excludes, 37 includes propagated without human intervention.',
    details: [
      '105 propagated as exclude at posterior ≥ 0.70.',
      '37 propagated as include at posterior ≤ 0.30.',
      'Recorded in similarity_triage.csv with each record\'s prior, cosine deltas, and posterior.',
    ],
  },
  {
    id: 'residual',
    label: 'Residual (uncertainty band)',
    count: '39',
    role: 'residual',
    summary: 'Records the triage could not classify with high confidence.',
    details: [
      'R001..R039 assembled by build_residual_sample.py.',
      'Labelled in a second UI session under rubric v1.1.0; comments preserved verbatim.',
      '7 includes and 32 excludes captured in the R session.',
    ],
  },
  {
    id: 'final',
    label: 'Final screening result',
    count: '88 include / 219 exclude',
    role: 'final',
    summary: 'PRISMA node 8: 219 excluded; node 9: 88 advanced to full-text retrieval.',
    details: [
      'Composition of the 88 includes: 44 seed + 37 auto-propagated + 7 residual.',
      'Composition of the 219 excludes: 82 seed + 105 auto-propagated + 32 residual.',
      'All 114 human excludes re-audited under rubric v1.2.0 as a PRISMA Item 24b protocol amendment.',
      'v1.2.0 code distribution: E1=6, E2=12, E3=15, E4=2, E5=2, E6=2, E7=48, E8=14, E9=7, E10=6.',
    ],
  },
];

// Layout: rows and columns on the ReactFlow canvas.
interface StageLayout {
  id: string;
  col: number;
  row: number;
}

const LAYOUT: StageLayout[] = [
  { id: 'pool',        col: 0, row: 0 },
  { id: 'power',       col: 0, row: 1 },
  { id: 'seed',        col: 0, row: 2 },
  { id: 'prior',       col: 1, row: 3 },
  { id: 'likelihood',  col: 2, row: 3 },
  { id: 'posterior',   col: 1, row: 4 },
  { id: 'propagated',  col: 0, row: 5 },
  { id: 'residual',    col: 2, row: 5 },
  { id: 'final',       col: 1, row: 6 },
];

const EDGES: Array<[string, string]> = [
  ['pool', 'power'],
  ['power', 'seed'],
  ['seed', 'prior'],
  ['seed', 'likelihood'],
  ['prior', 'posterior'],
  ['likelihood', 'posterior'],
  ['posterior', 'propagated'],
  ['posterior', 'residual'],
  ['propagated', 'final'],
  ['residual', 'final'],
];

const NODE_WIDTH = 240;
const NODE_HEIGHT = 92;
const COL_GAP = 60;
const ROW_GAP = 46;

const nodeTypes = { screeningStage: ScreeningStageNode };

export function ScreeningFlow() {
  return (
    <ReactFlowProvider>
      <ScreeningFlowInner />
    </ReactFlowProvider>
  );
}

function ScreeningFlowInner() {
  const [selectedId, setSelectedId] = useState<string>('final');
  const byId = useMemo(() => Object.fromEntries(STAGES.map(s => [s.id, s])), []);

  const rfNodes: Node[] = useMemo(() => LAYOUT.map(l => {
    const stage = byId[l.id];
    return {
      id: l.id,
      type: 'screeningStage' as const,
      position: {
        x: l.col * (NODE_WIDTH + COL_GAP),
        y: l.row * (NODE_HEIGHT + ROW_GAP),
      },
      data: { stage, active: selectedId === l.id },
      draggable: false,
      selectable: false,
      connectable: false,
      style: { width: NODE_WIDTH, cursor: 'pointer' },
    };
  }), [byId, selectedId]);

  const rfEdges: Edge[] = useMemo(() => EDGES.map(([from, to]) => ({
    id: `${from}->${to}`,
    source: from,
    target: to,
    type: 'smoothstep',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--ink-mute)', width: 14, height: 14 },
    style: { stroke: 'var(--line-strong)', strokeWidth: 1.5 },
  })), []);

  const onNodeClick = useCallback<NodeMouseHandler>((_evt, node) => {
    setSelectedId(node.id);
  }, []);

  const maxRow = Math.max(...LAYOUT.map(l => l.row));
  const canvasHeight = (maxRow + 1) * (NODE_HEIGHT + ROW_GAP) + 60;
  const active = byId[selectedId];

  return (
    <div className={styles.wrap}>
      <div className={styles.canvas} style={{ height: canvasHeight }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.6}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <aside className={styles.details}>
        <div className={styles.detailsHeader}>
          <Chip variant={roleChipVariant(active.role)}>{active.count}</Chip>
          <h3 className={styles.detailsTitle}>{active.label}</h3>
        </div>
        <p className={styles.detailsSummary}>{active.summary}</p>
        <ul className={styles.detailsList}>
          {active.details.map(d => <li key={d}>{d}</li>)}
        </ul>
        <p className={styles.hint}>Click any stage in the diagram to inspect it here.</p>
      </aside>
    </div>
  );
}

function roleChipVariant(role: ScreeningStage['role']) {
  if (role === 'pool' || role === 'sample') return 'neutral';
  if (role === 'triage') return 'accent';
  if (role === 'residual') return 'warn';
  return 'good';
}

interface ScreeningNodeData {
  stage: ScreeningStage;
  active: boolean;
  [key: string]: unknown;
}

function ScreeningStageNode(props: NodeProps) {
  const { stage, active } = props.data as unknown as ScreeningNodeData;
  return (
    <div
      className={`${styles.node} ${styles[stage.role]} ${active ? styles.nodeActive : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${stage.label}: ${stage.count}`}
    >
      <div className={styles.nodeCount}>{stage.count}</div>
      <div className={styles.nodeLabel}>{stage.label}</div>
      <ReactFlowHandles />
    </div>
  );
}

// Handles are still needed for edges to attach; imported lazily below.
import { Handle, Position } from '@xyflow/react';

function ReactFlowHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top}    className={styles.handle} />
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
      <Handle type="target" position={Position.Left}   id="in-left"   className={styles.handle} />
      <Handle type="source" position={Position.Right}  id="out-right" className={styles.handle} />
    </>
  );
}
