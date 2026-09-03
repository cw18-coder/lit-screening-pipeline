import { Link, useParams } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { Chip } from '../components/Chip';
import { RowTable, type RowTableColumn } from '../components/RowTable';
import { useJson } from '../hooks/useJson';

interface LogRow {
  stable_id: string;
  anchor_id?: string;
  signpost_id?: string;
  authors: string;
  year: number | null;
  title: string;
  venue: string;
  doi_url: string;
  notes?: string;
  method_family?: string;
  signpost_role?: string;
}

const CONFIG: Record<string, { title: string; source: string; intro: string; idCol: 'anchor_id' | 'signpost_id'; extraCol?: { key: string; label: string } }> = {
  'ch3-methods-anchors': {
    title: 'Chapter 3 methodology anchors',
    source: 'non-prisma-ch3.json',
    intro:
      'References cited as methodological precedents in Chapter 3 (identification-strategy literature, quasi-experimental designs). Not part of the PRISMA funnel — recorded here as a non-PRISMA log for audit.',
    idCol: 'anchor_id',
    extraCol: { key: 'method_family', label: 'Method family' },
  },
  'signpost-citations': {
    title: 'Signpost citations',
    source: 'non-prisma-signposts.json',
    intro:
      'References cited as signposts (framing, definitions, method-precedent) rather than reviewed as evidence. Land in the final reference list without entering the Track 2 PRISMA arm.',
    idCol: 'signpost_id',
    extraCol: { key: 'signpost_role', label: 'Role' },
  },
};

export function LogsPage() {
  const { logId = '' } = useParams<{ logId: string }>();
  const cfg = CONFIG[logId];
  const { data: rows } = useJson<LogRow[]>(cfg?.source ?? 'non-prisma-ch3.json');

  if (!cfg) {
    return (
      <div className="route-view">
        <p><Link to="/prisma">← PRISMA</Link></p>
        <h1>Unknown log: <code>{logId}</code></h1>
        <Callout>Available: <code>#/logs/ch3-methods-anchors</code>, <code>#/logs/signpost-citations</code>.</Callout>
      </div>
    );
  }

  const columns: RowTableColumn<LogRow>[] = [
    { key: cfg.idCol, label: cfg.idCol === 'anchor_id' ? 'Anchor' : 'Signpost', width: '110px',
      render: r => <Chip variant="accent" mono>{(r[cfg.idCol] ?? '')}</Chip> },
    { key: 'title', label: 'Title', render: r => <span>{r.title}</span> },
    { key: 'authors', label: 'Authors', render: r => <span style={{ color: 'var(--ink-dim)' }}>{r.authors}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'venue', label: 'Venue' },
    ...(cfg.extraCol ? [{ key: cfg.extraCol.key, label: cfg.extraCol.label } as RowTableColumn<LogRow>] : []),
    { key: 'doi_url', label: 'Link', width: '90px', render: r => r.doi_url
      ? <a href={r.doi_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>DOI ↗</a>
      : <span style={{ color: 'var(--ink-mute)' }}>—</span> },
  ];

  return (
    <div className="route-view">
      <p><Link to="/prisma">← PRISMA</Link></p>
      <h1>{cfg.title}</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '78ch' }}>{cfg.intro}</p>
      {!rows ? <p>Loading…</p> : (
        <RowTable
          rows={rows}
          columns={columns}
          searchFields={['title', 'authors', 'venue', cfg.idCol]}
          pageSize={25}
          initialSort={[cfg.idCol, 'asc']}
        />
      )}
    </div>
  );
}
