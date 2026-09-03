import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { PrismaTallyNode } from '../types/prisma';
import {
  DIAGRAM_EDGES,
  DIAGRAM_NODES,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_GAP,
  nodePosition,
  type DiagramEdgeSpec,
} from '../data/prismaLayout';
import { PrismaFlowNode, type PrismaFlowNodeData } from './PrismaFlowNode';
import styles from './PrismaDiagram.module.css';

const nodeTypes = { prismaNode: PrismaFlowNode };

export interface PrismaDiagramProps {
  nodes: PrismaTallyNode[];
}

export function PrismaDiagram({ nodes }: PrismaDiagramProps) {
  const byId = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.node_id, n])),
    [nodes]
  );

  const rfNodes: Node<PrismaFlowNodeData>[] = useMemo(() => {
    return DIAGRAM_NODES.filter(spec => byId[spec.id]).map(spec => ({
      id: spec.id,
      type: 'prismaNode',
      position: nodePosition(spec),
      data: {
        node: byId[spec.id],
        clickable: spec.clickable,
        hint: spec.hint,
      },
      draggable: false,
      selectable: false,
      connectable: false,
    }));
  }, [byId]);

  const rfEdges: Edge[] = useMemo(() => toRfEdges(DIAGRAM_EDGES), []);

  // Compute canvas bounds so ReactFlow can fit-view.
  const maxRow = Math.max(...DIAGRAM_NODES.map(n => n.row), 5);
  const canvasHeight = (maxRow + 1) * (NODE_HEIGHT + ROW_GAP) + 60;

  return (
    <div className={styles.wrap} style={{ height: canvasHeight }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.08, minZoom: 0.4, maxZoom: 1.2 }}
          minZoom={0.4}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll={false}
          panOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className={styles.bg} />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

// Route edges through Handles that match the geometry: sideways for branches,
// straight vertical for the main spine.
function toRfEdges(specs: DiagramEdgeSpec[]): Edge[] {
  return specs.map(spec => {
    const isBranch = spec.variant === 'branch';
    const isReassign = spec.variant === 'reassign';
    const sourceHandle = isBranch ? 'out-right' : 'out-bottom';
    const targetHandle = isBranch || isReassign ? 'in-left' : 'in-top';
    return {
      id: `${spec.from}__${spec.to}`,
      source: spec.from,
      target: spec.to,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: false,
      label: spec.label,
      labelStyle: labelStyle(spec.variant),
      labelBgStyle: labelBgStyle(spec.variant),
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: edgeColor(spec.variant),
      },
      style: {
        stroke: edgeColor(spec.variant),
        strokeWidth: isBranch ? 1.5 : 2,
        strokeDasharray: isReassign ? '4 4' : undefined,
      },
    };
  });
}

function edgeColor(variant?: string): string {
  switch (variant) {
    case 'branch':   return 'var(--accent-2)';
    case 'reassign': return 'var(--good)';
    default:         return 'var(--ink-mute)';
  }
}

function labelStyle(variant?: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontFamily: 'var(--mono)',
    fontWeight: 600,
    fill: variant === 'branch' ? 'var(--accent-2)'
        : variant === 'reassign' ? 'var(--good)'
        : 'var(--ink-dim)',
  };
}

function labelBgStyle(_variant?: string): React.CSSProperties {
  return {
    fill: 'var(--panel-2)',
    stroke: 'var(--line)',
    strokeWidth: 1,
  };
}

// Silence unused-import lint on NODE_WIDTH.
export const _NODE_W = NODE_WIDTH;
