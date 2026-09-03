import { useParams } from 'react-router-dom';

export function PrismaNode() {
  const { nodeId } = useParams<{ nodeId: string }>();
  return (
    <div className="route-view">
      <h1>PRISMA node: {nodeId}</h1>
      <p style={{ color: 'var(--ink-dim)' }}>Drill-down page under construction (M3).</p>
    </div>
  );
}
