import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  return (
    <ReactFlowProvider>
      <PrismaDiagramInner nodes={nodes} />
    </ReactFlowProvider>
  );
}

// Inner component so that useNavigate can share the router context and
// onNodeClick can dispatch navigation without re-instantiating callbacks.
function PrismaDiagramInner({ nodes }: PrismaDiagramProps) {
  const navigate = useNavigate();

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
      style: { width: NODE_WIDTH, cursor: spec.clickable ? 'pointer' : 'default' },
    }));
  }, [byId]);

  const rfEdges: Edge[] = useMemo(() => toRfEdges(DIAGRAM_EDGES), []);

  // Reliable click-through: React Flow's own node-click event fires regardless
  // of pointer-events on inner elements. Custom-node onClick is unreliable
  // when nodesDraggable=false + elementsSelectable=false.
  const onNodeClick = useCallback<NodeMouseHandler>((_evt, node) => {
    const data = node.data as PrismaFlowNodeData;
    if (data?.clickable) {
      navigate(`/prisma/${node.id}`);
    }
  }, [navigate]);

  const maxRow = Math.max(...DIAGRAM_NODES.map(n => n.row), 5);
  const canvasHeight = (maxRow + 1) * (NODE_HEIGHT + ROW_GAP) + 80;

  return (
    <div className={styles.wrap} style={{ height: canvasHeight }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.1, minZoom: 0.4, maxZoom: 1.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className={styles.bg} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

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
      pathOptions: { borderRadius: 12, offset: 24 },
      animated: false,
      label: spec.label,
      labelStyle: labelStyle(spec.variant),
      labelBgStyle: labelBgStyle(),
      labelBgPadding: [8, 5] as [number, number],
      labelBgBorderRadius: 6,
      labelShowBg: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: edgeColor(spec.variant),
      },
      style: {
        stroke: edgeColor(spec.variant),
        strokeWidth: isBranch ? 1.5 : 2,
        strokeDasharray: isReassign ? '5 5' : undefined,
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

function labelBgStyle(): React.CSSProperties {
  return {
    fill: 'var(--panel)',
    stroke: 'var(--line)',
    strokeWidth: 1,
  };
}

// Silence unused-import lint on NODE_WIDTH re-export shim.
export const _NODE_W = NODE_WIDTH;
