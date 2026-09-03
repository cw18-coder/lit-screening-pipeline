import { useParams } from 'react-router-dom';

export function WikiPage() {
  const { section, pageId } = useParams<{ section: string; pageId: string }>();
  return (
    <div className="route-view">
      <h1>{section} / {pageId}</h1>
      <p style={{ color: 'var(--ink-dim)' }}>Wiki page renderer coming in M4.</p>
    </div>
  );
}
