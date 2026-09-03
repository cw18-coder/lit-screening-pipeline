import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PrismaTallyNode } from '../types/prisma';
import styles from './PrismaFlowNode.module.css';

export interface PrismaFlowNodeData {
  node: PrismaTallyNode;
  clickable: boolean;
  hint?: string;
  [key: string]: unknown;
}

// The visual body of a PRISMA node. Click and keyboard handling live at the
// ReactFlow container level (see PrismaDiagram.onNodeClick) because inner
// onClick handlers are unreliable when nodesDraggable + elementsSelectable
// are both disabled.
export function PrismaFlowNode(props: NodeProps) {
  const { node, clickable, hint } = props.data as PrismaFlowNodeData;

  const stageClass = styles[node.prisma_stage] ?? '';
  const trackClass = styles[node.track] ?? '';
  const clickClass = clickable ? styles.clickable : styles.transit;

  const countText = node.count == null ? '—' : String(node.count);

  return (
    <div
      className={`${styles.node} ${stageClass} ${trackClass} ${clickClass}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      aria-label={
        clickable
          ? `${node.label}: ${countText} records. Click to open drill-down.`
          : `${node.label}: ${countText} records.`
      }
    >
      <div className={styles.count}>{countText}</div>
      <div className={styles.label}>{node.label}</div>
      {clickable && hint && (
        <div className={styles.hint}>{hint} →</div>
      )}

      <Handle type="target" position={Position.Top}    id="in-top"     className={styles.handle} />
      <Handle type="target" position={Position.Left}   id="in-left"    className={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className={styles.handle} />
      <Handle type="source" position={Position.Right}  id="out-right"  className={styles.handle} />
    </div>
  );
}
