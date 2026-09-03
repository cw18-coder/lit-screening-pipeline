import { useNavigate } from 'react-router-dom';
import type { KeyboardEvent } from 'react';
import type { PrismaTallyNode } from '../types/prisma';
import styles from './FlowNode.module.css';

export interface FlowNodeProps {
  node: PrismaTallyNode;
  x: number;
  y: number;
  width: number;
  height: number;
  onClick?: (nodeId: string) => void;
}

export function FlowNode({ node, x, y, width, height, onClick }: FlowNodeProps) {
  const navigate = useNavigate();

  const handle = () => {
    if (onClick) {
      onClick(node.node_id);
    } else {
      navigate(`/prisma/${node.node_id}`);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handle();
    }
  };

  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      <div
        className={`${styles.node} ${styles[node.track]} ${styles[node.prisma_stage]}`}
        role="button"
        tabIndex={0}
        onClick={handle}
        onKeyDown={onKey}
        aria-label={`${node.label}: ${node.count ?? 'not yet counted'}. Open drill-down.`}
      >
        <div className={styles.count}>{node.count == null ? '—' : node.count}</div>
        <div className={styles.label}>{node.label}</div>
        <div className={styles.source}>{node.source_log}</div>
      </div>
    </foreignObject>
  );
}
