import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AbstractDrawer } from '../components/AbstractDrawer';
import { Barchart } from '../components/Barchart';
import { Callout } from '../components/Callout';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { RowTable, type RowTableColumn } from '../components/RowTable';
import { useJson } from '../hooks/useJson';
import type {
  AbstractRecord,
  ConsensusQuestion,
  PrismaTallyNode,
  ScreeningExclusion,
  Track1Hit,
  Track1UniqueRef,
  Track2Anchor,
  Track2Decision,
} from '../types/prisma';
import { DRILLDOWN_CONFIG, type DrilldownConfig } from '../types/drilldown';
import styles from './PrismaNode.module.css';

export function PrismaNode() {
  const { nodeId = '' } = useParams<{ nodeId: string }>();
  const config = DRILLDOWN_CONFIG[nodeId];

  const { data: tally } = useJson<PrismaTallyNode[]>('prisma-tally.json');
  const node = tally?.find(n => n.node_id === nodeId) ?? null;

  if (!config) {
    return (
      <div className="route-view">
        <p><Link to="/prisma">← PRISMA</Link></p>
        <h1>Unknown node: <code>{nodeId}</code></h1>
        <Callout variant="accent-2">
          This node id does not appear in the drill-down configuration. If it was added recently,
          rebuild the site with <code>pnpm build:data</code>.
        </Callout>
      </div>
    );
  }

  return (
    <div className="route-view">
      <p>
        <Link to="/prisma">← PRISMA</Link>
      </p>
      <div className={styles.header}>
        <div className={styles.headerMeta}>
          <Chip variant="accent">{node?.prisma_stage ?? '—'}</Chip>
          <Chip variant={node?.track === 'track2' ? 'good' : 'accent'}>{node?.track ?? '—'}</Chip>
          <Chip mono>{nodeId}</Chip>
        </div>
        <h1>{node?.label ?? nodeId}</h1>
        <div className={styles.headerCounts}>
          <span className={styles.count}>{node?.count ?? '—'}</span>
          <span className={styles.countLabel}>records</span>
        </div>
        {node && (
          <div className={styles.headerFooter}>
            <span>source: <code>{node.source_log}</code></span>
            <span>updated: {node.last_updated}</span>
          </div>
        )}
        {config.intro && <p className={styles.intro}>{config.intro}</p>}
        {node?.notes && <p className={styles.notes}>{node.notes}</p>}
      </div>

      <NodePrimary config={config} nodeId={nodeId} />

      <NodeSecondary config={config} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Primary panel: row table sourced from `config.source`.
// -----------------------------------------------------------------------------

function NodePrimary({ config }: { config: DrilldownConfig; nodeId: string }) {
  if (config.source === 'none') {
    return (
      <Callout>
        This node is defined in the funnel but does not have underlying rows yet — it populates
        as the review advances to later PRISMA stages (screening, eligibility, included).
      </Callout>
    );
  }

  switch (config.source) {
    case 'identification-01a': return <T1HitsTable config={config} />;
    case 'identification-01b': return <T2AnchorsTable config={config} />;
    case 'identification-01c': return <T1UniqueTable config={config} />;
    case 'screening-excluded-2b': return <ScreeningExcludedTable config={config} />;
    case 'track2-decisions': return <T2DecisionsTable />;
    default: return null;
  }
}

// -----------------------------------------------------------------------------
// Row-source tables. Each one is a thin adapter over RowTable.
// -----------------------------------------------------------------------------

function T1HitsTable({ config }: { config: DrilldownConfig }) {
  const { data: rows } = useJson<Track1Hit[]>('identification-01a.json');
  const { data: abstracts } = useJson<AbstractRecord[]>('abstracts.json');
  const [selected, setSelected] = useState<AbstractRecord | null>(null);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return config.filter ? rows.filter(config.filter) : rows;
  }, [rows, config.filter]);

  const abstractsById = useMemo(() => {
    const m = new Map<string, AbstractRecord>();
    (abstracts ?? []).forEach(a => m.set(a.stable_id, a));
    return m;
  }, [abstracts]);

  if (!rows) return <p>Loading…</p>;

  const columns: RowTableColumn<Track1Hit>[] = [
    { key: 'query_id', label: 'Q', width: '60px' },
    { key: 'title', label: 'Title', render: r => <span className={styles.title}>{r.title || '—'}</span> },
    { key: 'authors', label: 'Authors', render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'venue', label: 'Venue', render: r => <span className={styles.dim}>{r.venue || '—'}</span> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>
        DOI ↗
      </a>
    ) },
  ];

  const handleRow = (row: Track1Hit) => {
    const abs = abstractsById.get(row.stable_id);
    if (abs) setSelected(abs);
  };

  return (
    <>
      <RowTable
        rows={filtered}
        columns={columns}
        searchFields={['title', 'authors', 'doi_url', 'query_id']}
        pageSize={25}
        initialSort={['query_id', 'asc']}
        onRowClick={handleRow}
        emptyMessage="No matching identification hits."
      />
      <AbstractDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function T1UniqueTable({ config }: { config: DrilldownConfig }) {
  const { data: rows } = useJson<Track1UniqueRef[]>('identification-01c.json');
  const { data: abstracts } = useJson<AbstractRecord[]>('abstracts.json');
  const [selected, setSelected] = useState<AbstractRecord | null>(null);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return config.filter ? rows.filter(config.filter) : rows;
  }, [rows, config.filter]);

  const abstractsById = useMemo(() => {
    const m = new Map<string, AbstractRecord>();
    (abstracts ?? []).forEach(a => m.set(a.stable_id, a));
    return m;
  }, [abstracts]);

  if (!rows) return <p>Loading…</p>;

  const columns: RowTableColumn<Track1UniqueRef>[] = [
    { key: 'primary_query_id', label: 'Q', width: '60px' },
    { key: 'title', label: 'Title', render: r => <span className={styles.title}>{r.title || '—'}</span> },
    { key: 'authors', label: 'Authors', render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'venue', label: 'Venue', render: r => <span className={styles.dim}>{r.venue || '—'}</span> },
    { key: 'track2_status', label: 'T2', width: '80px', render: r => r.track2_status
      ? <Chip variant="good">{r.track2_status}</Chip>
      : <span className={styles.dim}>—</span> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) },
  ];

  return (
    <>
      <RowTable
        rows={filtered}
        columns={columns}
        searchFields={['title', 'authors', 'doi_url', 'primary_query_id', 'track2_status']}
        pageSize={25}
        initialSort={['primary_query_id', 'asc']}
        onRowClick={r => {
          const abs = abstractsById.get(r.stable_id);
          if (abs) setSelected(abs);
        }}
        emptyMessage="No matching records."
      />
      <AbstractDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function T2AnchorsTable({ config }: { config: DrilldownConfig }) {
  const { data: rows } = useJson<Track2Anchor[]>('identification-01b.json');
  const { data: decisions } = useJson<Track2Decision[]>('track2-decisions.json');
  const [selectedDec, setSelectedDec] = useState<Track2Decision | null>(null);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return config.filter ? rows.filter(config.filter) : rows;
  }, [rows, config.filter]);

  const decisionsById = useMemo(() => {
    const m = new Map<string, Track2Decision>();
    (decisions ?? []).forEach(d => m.set(d.anchor_id, d));
    return m;
  }, [decisions]);

  if (!rows) return <p>Loading…</p>;

  const columns: RowTableColumn<Track2Anchor>[] = [
    { key: 'anchor_id', label: 'Anchor', width: '90px', render: r => <Chip variant="good" mono>{r.anchor_id}</Chip> },
    { key: 'title', label: 'Title', render: r => <span className={styles.title}>{r.title}</span> },
    { key: 'authors', label: 'Authors', render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'register_tag', label: 'Register' },
    { key: 'journal_sjr_quartile', label: 'SJR', width: '60px', render: r => r.journal_sjr_quartile
      ? <Chip variant="accent" mono>{r.journal_sjr_quartile}</Chip>
      : <span className={styles.dim}>—</span> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) },
  ];

  return (
    <>
      <RowTable
        rows={filtered}
        columns={columns}
        searchFields={['title', 'authors', 'anchor_id', 'register_tag']}
        pageSize={25}
        initialSort={['anchor_id', 'asc']}
        onRowClick={r => {
          const d = decisionsById.get(r.anchor_id);
          if (d) setSelectedDec(d);
        }}
        emptyMessage="No matching Track 2 anchors."
      />
      {selectedDec && (
        <DecisionOverlay decision={selectedDec} onClose={() => setSelectedDec(null)} />
      )}
    </>
  );
}

function ScreeningExcludedTable({ config }: { config: DrilldownConfig }) {
  const { data: rows } = useJson<ScreeningExclusion[]>('screening-excluded-2b.json');

  const filtered = useMemo(() => {
    if (!rows) return [];
    return config.filter ? rows.filter(config.filter) : rows;
  }, [rows, config.filter]);

  if (!rows) return <p>Loading…</p>;
  if (filtered.length === 0) {
    return (
      <Callout variant="accent-2" title="Reserved.">
        {' '}This node is populated after the AI adjudicator runs the 5-fold CV against the
        labelling sample. The former 19 Q15 en-bloc rows were reclassified as pre-screening
        removals — see the corresponding node.
      </Callout>
    );
  }

  const columns: RowTableColumn<ScreeningExclusion>[] = [
    { key: 'title', label: 'Title', render: r => <span className={styles.title}>{r.title}</span> },
    { key: 'authors', label: 'Authors', render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'excluded_at_stage', label: 'Stage' },
    { key: 'exclusion_reason', label: 'Reason', render: r => <span className={styles.dim}>{r.exclusion_reason || '—'}</span> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) },
  ];

  return (
    <RowTable
      rows={filtered}
      columns={columns}
      searchFields={['title', 'authors', 'exclusion_reason']}
      pageSize={25}
      initialSort={['title', 'asc']}
      emptyMessage="No screening exclusions."
    />
  );
}

function T2DecisionsTable() {
  const { data: rows } = useJson<Track2Decision[]>('track2-decisions.json');
  const [selectedDec, setSelectedDec] = useState<Track2Decision | null>(null);
  if (!rows) return <p>Loading…</p>;

  const columns: RowTableColumn<Track2Decision>[] = [
    { key: 'anchor_id', label: 'Anchor', width: '90px' },
    { key: 'title', label: 'Title' },
    { key: 'authors', label: 'Authors' },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'unit_alignment', label: 'Unit alignment' },
  ];
  return (
    <>
      <RowTable
        rows={rows}
        columns={columns}
        searchFields={['title', 'authors', 'anchor_id']}
        pageSize={25}
        initialSort={['anchor_id', 'asc']}
        onRowClick={r => setSelectedDec(r)}
      />
      {selectedDec && (
        <DecisionOverlay decision={selectedDec} onClose={() => setSelectedDec(null)} />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Secondary panels: query barchart, overlap table, Sanchez note.
// -----------------------------------------------------------------------------

function NodeSecondary({ config }: { config: DrilldownConfig }) {
  if (!config.extraPanels?.length) return null;
  return (
    <div className={styles.secondary}>
      {config.extraPanels.map(p => {
        switch (p) {
          case 'query_barchart': return <QueryBarchart key={p} />;
          case 'track2_overlap_table': return <OverlapNote key={p} />;
          case 'sanchez_note': return <SanchezNote key={p} />;
          default: return null;
        }
      })}
    </div>
  );
}

function QueryBarchart() {
  const { data: questions } = useJson<ConsensusQuestion[]>('questions.json');
  if (!questions || questions.length === 0) return null;
  const rows = questions
    .filter(q => q.operationalised !== false)
    .map(q => ({
      label: q.q_id,
      value: q.results_returned ?? 0,
      detail: `${q.q_id}: ${q.results_returned} results, ${q.unique_track1_hits} unique Track 1 hits`,
    }));
  return (
    <>
      <h2>Records returned per Consensus query</h2>
      <Card>
        <Barchart rows={rows} />
      </Card>
    </>
  );
}

function OverlapNote() {
  return (
    <Callout variant="accent" title="Cross-track overlap.">
      {' '}These 5 references are picked up by Consensus and also purposively selected as Track 2
      anchors. For counting purposes they are attributed to Track 2 and bypass title-abstract
      screening (their inclusion rationale lives in the anchor decision markdown).
    </Callout>
  );
}

function SanchezNote() {
  return (
    <Callout variant="accent-2" title="Sanchez et al. 2014.">
      {' '}One row in 01c had Q15 as primary query but was previously not written to 2b. Under the
      Q15-not-operationalised model, all 20 Q15-primary rows are marked
      <code> ignored_optional_q15 </code>, including Sanchez, so audit symmetry is preserved.
    </Callout>
  );
}

// -----------------------------------------------------------------------------
// Track 2 decision overlay — reuses the AbstractDrawer look for now.
// -----------------------------------------------------------------------------

function DecisionOverlay({ decision, onClose }: { decision: Track2Decision; onClose: () => void }) {
  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.overlayInner} onClick={e => e.stopPropagation()}>
        <div className={styles.overlayHead}>
          <div>
            <Chip variant="good" mono>{decision.anchor_id}</Chip>
            <Chip mono>{decision.year}</Chip>
            {decision.unit_alignment && <Chip variant="accent">{decision.unit_alignment}</Chip>}
          </div>
          <button className={styles.overlayClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.overlayBody}>
          <h2>{decision.title}</h2>
          <p className={styles.overlayAuthors}>{decision.authors}</p>
          {decision.research_unit && (
            <p className={styles.overlayField}><b>Research unit:</b> {decision.research_unit}</p>
          )}
          <h3>Inclusion rationale</h3>
          <pre className={styles.rationale}>{decision.rationale_md}</pre>
        </div>
      </div>
    </div>
  );
}

function shortAuthors(a: string, cap = 65): string {
  if (!a) return '—';
  return a.length > cap ? a.slice(0, cap) + '…' : a;
}
