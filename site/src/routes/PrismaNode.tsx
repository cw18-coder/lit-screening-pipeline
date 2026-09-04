import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AbstractDrawer } from '../components/AbstractDrawer';
import { Callout } from '../components/Callout';
import { Chip } from '../components/Chip';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { RowTable, type RowTableColumn } from '../components/RowTable';
import { useJson } from '../hooks/useJson';
import { humaneSourceLabel } from '../lib/humane';
import { DRILLDOWN_CONFIG, type DrilldownConfig } from '../types/drilldown';
import type {
  AbstractRecord,
  ConsensusQuestion,
  PrismaTallyNode,
  ScreeningExclusionCode,
  ScreeningExclusionPaper,
  ScreeningExclusionsByCode,
  Track1Hit,
  Track1UniqueRef,
  Track2Anchor,
  Track2Decision,
} from '../types/prisma';
import styles from './PrismaNode.module.css';

export function PrismaNode() {
  const { nodeId = '' } = useParams<{ nodeId: string }>();
  const config = DRILLDOWN_CONFIG[nodeId];

  const { data: tally } = useJson<PrismaTallyNode[]>('prisma-tally.json');
  const node = tally?.find(n => n.node_id === nodeId) ?? null;

  if (!config) {
    return (
      <div className="route-view">
        <BackLink />
        <h1>Unknown node: <code>{nodeId}</code></h1>
        <Callout variant="accent-2">
          This node is not registered in the drill-down catalogue.
        </Callout>
      </div>
    );
  }

  const source = node ? humaneSourceLabel(node.source_log) : null;

  return (
    <div className="route-view">
      <BackLink />
      <div className={styles.header}>
        <div className={styles.headerMeta}>
          {node && <Chip variant="accent">{stageLabel(node.prisma_stage)}</Chip>}
          {node && <Chip variant={node.track === 'track2' ? 'good' : 'accent'}>{trackLabel(node.track)}</Chip>}
        </div>
        <h1>{node?.label ?? nodeId}</h1>
        <div className={styles.headerCounts}>
          <span className={styles.count}>{node?.count ?? '—'}</span>
          <span className={styles.countLabel}>records</span>
        </div>
        {source && (
          <div className={styles.headerFooter}>
            Sourced from the {source}.
          </div>
        )}
        {config.intro && <p className={styles.intro}>{config.intro}</p>}
      </div>

      <NodeBody variant={config.variant} />
    </div>
  );
}

function BackLink() {
  return (
    <p className={styles.back}>
      <Link to="/prisma">← Back to PRISMA overview</Link>
    </p>
  );
}

function NodeBody({ variant }: { variant: DrilldownConfig['variant'] }) {
  switch (variant) {
    case 'query_aggregation': return <QueryAggregationView />;
    case 'duplicates':        return <DuplicatesView />;
    case 'q15_ignored':       return <Q15IgnoredView />;
    case 'overlaps':          return <OverlapsView />;
    case 'track2_anchors':    return <Track2AnchorsView />;
    case 'exclusions_by_code': return <ExclusionsByCodeView />;
    case 'transit':
      return (
        <Callout variant="accent">
          This is a summary count carried forward from the earlier stage. There is nothing further
          to drill into — the underlying records are visible on the source and destination nodes.
        </Callout>
      );
    case 'reserved':
      return (
        <Callout variant="accent-2" title="Populates as full-text retrieval progresses.">
          {' '}Downstream stages populate as reports are pulled, assessed for eligibility, and
          promoted into the final review corpus.
        </Callout>
      );
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Query-level aggregation for identification_records_track1.
// -----------------------------------------------------------------------------

function QueryAggregationView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get('q');

  const { data: hits } = useJson<Track1Hit[]>('identification-01a.json');
  const { data: questions } = useJson<ConsensusQuestion[]>('questions.json');
  const { data: uniqueRefs } = useJson<Track1UniqueRef[]>('identification-01c.json');
  const { data: abstracts } = useJson<AbstractRecord[]>('abstracts.json');

  const abstractsById = useIndex(abstracts, a => a.stable_id);
  const uniqueRefsById = useIndex(uniqueRefs, u => u.stable_id);
  const [selected, setSelected] = useState<AbstractRecord | null>(null);

  const questionsById = useMemo(() => {
    const m = new Map<string, ConsensusQuestion>();
    (questions ?? []).forEach(q => m.set(q.q_id, q));
    return m;
  }, [questions]);

  const summaries = useMemo(() => {
    if (!hits) return [];
    const groups = new Map<string, Track1Hit[]>();
    for (const h of hits) {
      const q = h.query_id;
      if (!q) continue;
      const arr = groups.get(q) ?? [];
      arr.push(h);
      groups.set(q, arr);
    }
    const uniqueByQuery = new Map<string, Set<string>>();
    for (const [q, arr] of groups.entries()) {
      const s = new Set<string>();
      arr.forEach(h => s.add(h.stable_id));
      uniqueByQuery.set(q, s);
    }
    return Array.from(groups.entries()).map(([q, arr]) => {
      const meta = questionsById.get(q);
      // Fall back to the query_text embedded on each 01a row when no
      // dedicated question metadata is available.
      const rawText = meta?.text || arr[0]?.query_text || '';
      return {
        q_id: q,
        text: rawText,
        results_returned: arr.length,
        unique_papers: uniqueByQuery.get(q)?.size ?? arr.length,
        retrieval_date: meta?.retrieval_date ?? '',
      };
    }).sort((a, b) => a.q_id.localeCompare(b.q_id, undefined, { numeric: true }));
  }, [hits, questionsById]);

  if (!hits) return <p>Loading…</p>;

  if (!activeQuery) {
    // Query-level table
    const columns: RowTableColumn<typeof summaries[number]>[] = [
      { key: 'q_id', label: 'Query', width: '90px',
        render: r => <Chip variant="accent" mono>{r.q_id}</Chip> },
      { key: 'text', label: 'Query text',
        render: r => <span className={styles.queryText}>{r.text || '—'}</span> },
      { key: 'results_returned', label: 'Returned', width: '90px' },
      { key: 'unique_papers', label: 'Unique', width: '90px' },
    ];
    return (
      <>
        <RowTable
          rows={summaries}
          columns={columns}
          searchFields={['q_id', 'text']}
          pageSize={25}
          initialSort={['q_id', 'asc']}
          onRowClick={row => setSearchParams({ q: row.q_id })}
          emptyMessage="No queries in the active pool."
        />
        <p className={styles.hint}>
          Click a query to see the papers it returned. Click a paper to read its abstract.
        </p>
      </>
    );
  }

  // Per-query paper table
  const rows = hits.filter(h => h.query_id === activeQuery);
  const queryMeta = questionsById.get(activeQuery);
  const queryText = queryMeta?.text || rows[0]?.query_text || '';

  const columns: RowTableColumn<Track1Hit>[] = [
    { key: 'title', label: 'Title', render: r => {
      const inActive = uniqueRefsById.get(r.stable_id) != null;
      return (
        <div>
          <div className={styles.paperTitle}>{r.title || '(no title)'}</div>
          {!inActive && <div className={styles.paperTag}>collapsed into another hit at dedup</div>}
        </div>
      );
    } },
    { key: 'authors', label: 'Authors', render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'venue', label: 'Venue', render: r => <span className={styles.dim}>{r.venue || '—'}</span> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => r.doi_url ? (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) : <span className={styles.dim}>—</span> },
  ];

  return (
    <>
      <div className={styles.subheader}>
        <button className={styles.crumbBtn} onClick={() => setSearchParams({})}>← All queries</button>
        <div className={styles.subtitle}>
          <Chip variant="accent" mono>{activeQuery}</Chip>{' '}
          {queryText && <span className={styles.queryText}>{queryText}</span>}
        </div>
      </div>
      <RowTable
        rows={rows}
        columns={columns}
        searchFields={['title', 'authors']}
        pageSize={20}
        onRowClick={r => { const a = abstractsById.get(r.stable_id); if (a) setSelected(a); }}
      />
      <p className={styles.hint}>Click a paper for its abstract.</p>
      <AbstractDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// -----------------------------------------------------------------------------
// 108 duplicates: papers with hit_count > 1
// -----------------------------------------------------------------------------

function DuplicatesView() {
  const { data: uniqueRefs } = useJson<Track1UniqueRef[]>('identification-01c.json');
  const { data: abstracts } = useJson<AbstractRecord[]>('abstracts.json');
  const abstractsById = useIndex(abstracts, a => a.stable_id);
  const [selected, setSelected] = useState<AbstractRecord | null>(null);

  if (!uniqueRefs) return <p>Loading…</p>;
  const rows = uniqueRefs.filter(r => (r.hit_count ?? 1) > 1);

  const columns: RowTableColumn<Track1UniqueRef>[] = [
    { key: 'title', label: 'Title',
      render: r => <div className={styles.paperTitle}>{r.title || '(no title)'}</div> },
    { key: 'authors', label: 'Authors',
      render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'query_ids', label: 'Surfaced by', render: r => (
      <div className={styles.chipRow}>
        {(r.query_ids || '').split('|').filter(Boolean).map(q => (
          <Chip key={q} variant="accent" mono>{q}</Chip>
        ))}
      </div>
    ) },
    { key: 'hit_count', label: 'Times', width: '70px' },
  ];

  return (
    <>
      <RowTable
        rows={rows}
        columns={columns}
        searchFields={['title', 'authors', 'query_ids']}
        pageSize={25}
        initialSort={['hit_count', 'desc']}
        onRowClick={r => { const a = abstractsById.get(r.stable_id); if (a) setSelected(a); }}
        emptyMessage="No duplicate hits in the active pool."
      />
      <p className={styles.hint}>Click a paper for its abstract.</p>
      <AbstractDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// -----------------------------------------------------------------------------
// Q15 optional: 20 papers + decision text
// -----------------------------------------------------------------------------

function Q15IgnoredView() {
  const { data: ignored } = useJson<Track1Hit[]>('identification-01a-ignored.json');
  const { data: abstracts } = useJson<AbstractRecord[]>('abstracts.json');
  const abstractsById = useIndex(abstracts, a => a.stable_id);
  const [selected, setSelected] = useState<AbstractRecord | null>(null);

  // De-duplicate ignored hits by stable_id so we show 20 distinct papers, not
  // multiple query-tagged rows for the same paper.
  const q15Rows = useMemo(() => {
    const seen = new Set<string>();
    const unique: Track1Hit[] = [];
    for (const r of ignored ?? []) {
      if (seen.has(r.stable_id)) continue;
      seen.add(r.stable_id);
      unique.push(r);
    }
    return unique;
  }, [ignored]);

  const columns: RowTableColumn<Track1Hit>[] = [
    { key: 'title', label: 'Title',
      render: r => <div className={styles.paperTitle}>{r.title || '(no title)'}</div> },
    { key: 'authors', label: 'Authors',
      render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'venue', label: 'Venue',
      render: r => <span className={styles.dim}>{r.venue || '—'}</span> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => r.doi_url ? (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) : <span className={styles.dim}>—</span> },
  ];

  return (
    <>
      <Callout variant="accent-2" title="Reviewer decision.">
        {' '}Q15 was an optional Consensus query that probed the psychology-adjacent literature on
        automation trust, complacency, and workload. After reading the returned abstracts, the
        reviewer concluded these papers do not carry the correctness-wedge signal that anchors the
        review (they measure operator vigilance rather than developer productivity or code review
        outcomes). Q15 was therefore not operationalised. The 20 hits stay on record for audit but
        do not enter any downstream count.
      </Callout>
      {q15Rows.length === 0 ? (
        <p className={styles.dim}>No Q15 hits are present in the current data snapshot.</p>
      ) : (
        <>
          <RowTable
            rows={q15Rows}
            columns={columns}
            searchFields={['title', 'authors']}
            pageSize={25}
            initialSort={['year', 'desc']}
            onRowClick={r => { const a = abstractsById.get(r.stable_id); if (a) setSelected(a); }}
          />
          <p className={styles.hint}>Click a paper for its abstract.</p>
        </>
      )}
      <AbstractDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// -----------------------------------------------------------------------------
// screening exclusions grouped by rubric v1.2.0 code
// -----------------------------------------------------------------------------

function ExclusionsByCodeView() {
  const { data } = useJson<ScreeningExclusionsByCode>('screening-excluded-by-code.json');
  const { data: abstracts } = useJson<AbstractRecord[]>('abstracts.json');
  const abstractsById = useIndex(abstracts, a => a.stable_id);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<AbstractRecord | null>(null);

  if (!data) return <p className={styles.dim}>Loading exclusion breakdown…</p>;

  const activeCode = selectedCode
    ? data.codes.find(c => c.code === selectedCode) ?? null
    : null;

  if (activeCode) {
    return (
      <>
        <p className={styles.back}>
          <button
            type="button"
            onClick={() => setSelectedCode(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', textDecoration: 'underline', padding: 0 }}
          >
            ← Back to exclusion codes
          </button>
        </p>
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <Chip variant="accent">{activeCode.code}</Chip>
            <Chip variant="accent">{activeCode.papers.length} records</Chip>
          </div>
          <h2 style={{ marginTop: 8 }}>{activeCode.label}</h2>
          <p className={styles.intro}>{activeCode.description}</p>
        </div>
        <PapersUnderCodeTable
          papers={activeCode.papers}
          onSelect={paper => {
            const abstract = abstractsById.get(paper.stable_id);
            if (abstract) setSelectedPaper(abstract);
          }}
        />
        <p className={styles.hint}>Click a paper for its abstract.</p>
        <AbstractDrawer record={selectedPaper} onClose={() => setSelectedPaper(null)} />
      </>
    );
  }

  const codeColumns: RowTableColumn<ScreeningExclusionCode>[] = [
    { key: 'code', label: 'Code', width: '70px',
      render: r => <Chip variant="accent">{r.code}</Chip> },
    { key: 'label', label: 'Label',
      render: r => <strong>{r.label}</strong> },
    { key: 'count', label: 'Records', width: '90px',
      render: r => <span className={styles.paperTitle}>{r.count}</span> },
    { key: 'description', label: 'When it applies',
      render: r => <span className={styles.dim}>{r.description}</span> },
  ];

  return (
    <>
      <Callout variant="accent-2" title={`Rubric v${data.rubric_version}.`}>
        {' '}{data.notes}
      </Callout>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0 18px' }}>
        <Chip variant="accent">Total {data.total}</Chip>
        <Chip variant="accent">Human-labelled {data.human_labelled}</Chip>
        <Chip variant="accent">AI-propagated {data.ai_propagated}</Chip>
      </div>
      <RowTable
        rows={data.codes}
        columns={codeColumns}
        pageSize={20}
        onRowClick={r => setSelectedCode(r.code)}
      />
      <p className={styles.hint}>
        Click a code to see the papers grouped under it. The v1.1.0 to v1.2.0 rubric refinement is
        documented as a PRISMA 2020 Item 24b protocol amendment. AI-propagated excludes carry a
        query but no v1.2.0 code because the Bayesian triage does not tick rubric boxes; they are
        grouped under an AI bucket at the bottom of the table.
      </p>
    </>
  );
}

function PapersUnderCodeTable({
  papers,
  onSelect,
}: {
  papers: ScreeningExclusionPaper[];
  onSelect: (paper: ScreeningExclusionPaper) => void;
}) {
  const columns: RowTableColumn<ScreeningExclusionPaper>[] = [
    { key: 'title', label: 'Title',
      render: r => <div className={styles.paperTitle}>{r.title || '(no title)'}</div> },
    { key: 'authors', label: 'Authors',
      render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'venue', label: 'Venue',
      render: r => <span className={styles.dim}>{r.venue || '—'}</span> },
    { key: 'source', label: 'Source', width: '110px',
      render: r => <Chip variant={r.source.startsWith('ai_') ? 'accent-2' : 'accent'}>{prettySource(r.source)}</Chip> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => r.doi_url ? (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) : <span className={styles.dim}>—</span> },
  ];

  return (
    <RowTable
      rows={papers}
      columns={columns}
      searchFields={['title', 'authors', 'venue']}
      pageSize={25}
      initialSort={['year', 'desc']}
      onRowClick={onSelect}
    />
  );
}

function prettySource(source: string): string {
  if (source.startsWith('human_')) return source.slice(6);
  if (source === 'ai_similarity') return 'AI triage';
  return source;
}

// -----------------------------------------------------------------------------
// 5 overlaps
// -----------------------------------------------------------------------------

function OverlapsView() {
  const { data: uniqueRefs } = useJson<Track1UniqueRef[]>('identification-01c.json');
  const { data: abstracts } = useJson<AbstractRecord[]>('abstracts.json');
  const abstractsById = useIndex(abstracts, a => a.stable_id);
  const [selected, setSelected] = useState<AbstractRecord | null>(null);

  if (!uniqueRefs) return <p>Loading…</p>;
  const rows = uniqueRefs.filter(r => Boolean(r.track2_status));

  const columns: RowTableColumn<Track1UniqueRef>[] = [
    { key: 'track2_status', label: 'Anchor', width: '110px',
      render: r => <Chip variant="good" mono>{r.track2_status}</Chip> },
    { key: 'title', label: 'Title',
      render: r => <div className={styles.paperTitle}>{r.title || '(no title)'}</div> },
    { key: 'authors', label: 'Authors',
      render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => r.doi_url ? (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) : <span className={styles.dim}>—</span> },
  ];

  return (
    <>
      <RowTable
        rows={rows}
        columns={columns}
        searchFields={['title', 'authors', 'track2_status']}
        pageSize={25}
        initialSort={['track2_status', 'asc']}
        onRowClick={r => { const a = abstractsById.get(r.stable_id); if (a) setSelected(a); }}
      />
      <p className={styles.hint}>Click a paper for its abstract.</p>
      <AbstractDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// -----------------------------------------------------------------------------
// Track 2 anchors: 22 rows with rich decision viewer.
// -----------------------------------------------------------------------------

function Track2AnchorsView() {
  const { data: anchors } = useJson<Track2Anchor[]>('identification-01b.json');
  const { data: decisions } = useJson<Track2Decision[]>('track2-decisions.json');
  const decisionsById = useIndex(decisions, d => d.anchor_id);
  const [selected, setSelected] = useState<Track2Decision | null>(null);

  if (!anchors) return <p>Loading…</p>;

  const columns: RowTableColumn<Track2Anchor>[] = [
    { key: 'anchor_id', label: 'Anchor', width: '90px',
      render: r => <Chip variant="good" mono>{r.anchor_id}</Chip> },
    { key: 'title', label: 'Title',
      render: r => <div className={styles.paperTitle}>{r.title || '(no title)'}</div> },
    { key: 'authors', label: 'Authors',
      render: r => <span className={styles.dim}>{shortAuthors(r.authors)}</span> },
    { key: 'year', label: 'Year', width: '60px' },
    { key: 'register_tag', label: 'Register' },
    { key: 'journal_sjr_quartile', label: 'SJR', width: '70px',
      render: r => r.journal_sjr_quartile
        ? <Chip variant="accent" mono>{r.journal_sjr_quartile}</Chip>
        : <span className={styles.dim}>—</span> },
    { key: 'doi_url', label: 'Link', width: '90px', render: r => r.doi_url ? (
      <a href={r.doi_url} target="_blank" rel="noopener noreferrer" className={styles.doiLink}>DOI ↗</a>
    ) : <span className={styles.dim}>—</span> },
  ];

  return (
    <>
      <RowTable
        rows={anchors}
        columns={columns}
        searchFields={['title', 'authors', 'anchor_id', 'register_tag']}
        pageSize={25}
        initialSort={['anchor_id', 'asc']}
        onRowClick={r => { const d = decisionsById.get(r.anchor_id); if (d) setSelected(d); }}
      />
      <p className={styles.hint}>Click a row to read the full inclusion rationale.</p>
      {selected && (
        <DecisionOverlay decision={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function DecisionOverlay({ decision, onClose }: { decision: Track2Decision; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.overlayInner} onClick={e => e.stopPropagation()}>
        <div className={styles.overlayHead}>
          <div className={styles.overlayChips}>
            <Chip variant="good" mono>{decision.anchor_id}</Chip>
            {decision.year && <Chip mono>{String(decision.year)}</Chip>}
            {decision.unit_alignment && <Chip variant="accent">{decision.unit_alignment}</Chip>}
          </div>
          <button className={styles.overlayClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.overlayBody}>
          <h2 className={styles.overlayTitle}>{decision.title || '(no title)'}</h2>
          <p className={styles.overlayAuthors}>{decision.authors}</p>
          {decision.research_unit && (
            <p className={styles.overlayField}><b>Research unit:</b> {decision.research_unit}</p>
          )}
          <h3 className={styles.overlaySection}>Inclusion rationale</h3>
          <MarkdownRenderer source={decision.rationale_md || '_No rationale recorded._'} />
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function useIndex<T>(rows: T[] | null | undefined, keyFn: (t: T) => string): Map<string, T> {
  return useMemo(() => {
    const m = new Map<string, T>();
    (rows ?? []).forEach(r => m.set(keyFn(r), r));
    return m;
  }, [rows, keyFn]);
}

function shortAuthors(a: string, cap = 65): string {
  if (!a) return '—';
  return a.length > cap ? a.slice(0, cap) + '…' : a;
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'identification': return 'Identification';
    case 'screening':      return 'Screening';
    case 'eligibility':    return 'Eligibility';
    case 'included':       return 'Included';
    default:               return stage;
  }
}

function trackLabel(track: string): string {
  switch (track) {
    case 'track1':   return 'Track 1 · Consensus';
    case 'track2':   return 'Track 2 · Purposive';
    case 'combined': return 'Combined';
    default:         return track;
  }
}
