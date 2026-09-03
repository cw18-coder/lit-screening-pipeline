import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNavigate } from 'react-router-dom';
import type { PrismaTallyNode } from '../types/prisma';
import styles from './PrismaFlowNode.module.css';

export interface PrismaFlowNodeData {
  node: PrismaTallyNode;
  clickable: boolean;
  hint?: string;
  [key: string]: unknown;
}

export function PrismaFlowNode(props: NodeProps) {
  const { node, clickable, hint } = props.data as PrismaFlowNodeData;
  const navigate = useNavigate();

  const stageClass = styles[node.prisma_stage] ?? '';
  const trackClass = styles[node.track] ?? '';
  const clickClass = clickable ? styles.clickable : styles.transit;

  const handleClick = () => {
    if (clickable) navigate(`/prisma/${node.node_id}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const countText = node.count == null ? '—' : String(node.count);

  return (
    <div
      className={`${styles.node} ${stageClass} ${trackClass} ${clickClass}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={handleClick}
      onKeyDown={onKey}
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

      {/* React Flow handles: top and bottom for main spine, side handles for branches */}
      <Handle type="target" position={Position.Top}   id="in-top"    className={styles.handle} />
      <Handle type="target" position={Position.Left}  id="in-left"   className={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className={styles.handle} />
      <Handle type="source" position={Position.Right}  id="out-right"  className={styles.handle} />
    </div>
  );
}
