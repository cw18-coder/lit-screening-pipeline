// Position, connectivity, and interactivity of every node in the PRISMA
// diagram. Keeps the diagram code declarative; adding a stage means one entry
// here + one entry in DRILLDOWN_CONFIG. No layout is derived from data — the
// coordinate choices carry PRISMA-2020 semantics that the reader needs to see
// at a glance (parallel identification columns, side branches for
// pre-screening removals, merged include node at the bottom).

export interface DiagramNodeSpec {
  id: string;
  column: 'track1' | 'track2' | 'combined' | 'branch';
  row: number;                  // vertical row index, 0 at top
  clickable: boolean;           // false for transit nodes (312, 307, "not populated")
  hint?: string;                // click-through prompt shown under the count
}

export interface DiagramEdgeSpec {
  from: string;
  to: string;
  label?: string;
  variant?: 'main' | 'branch' | 'reassign';
}

const COL_X: Record<DiagramNodeSpec['column'], number> = {
  track1: 0,
  branch: 380,   // pushed further right so the "reassigned to Track 2" label sits in clear space
  track2: 720,   // widen the outer column too so Track 2's spine keeps clear of the branch
  combined: 380,
};

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 100;
export const ROW_GAP = 64;   // more vertical breathing room between rows

export function nodePosition(spec: DiagramNodeSpec): { x: number; y: number } {
  // The overlaps node sits at a half-row offset so it visibly straddles the
  // 312 → 307 transition without colliding with either row's edges/labels.
  const rowOffset = spec.id === 'cross_track_overlaps' ? -0.4 : 0;
  return {
    x: COL_X[spec.column],
    y: (spec.row + rowOffset) * (NODE_HEIGHT + ROW_GAP),
  };
}

// Fifteen nodes shown in the diagram. Placeholders for eligibility / included
// live in DRILLDOWN_CONFIG but stay off the visible diagram until they have
// data, per the guiding principle that the site must not claim counts the
// underlying data cannot support.
export const DIAGRAM_NODES: DiagramNodeSpec[] = [
  { id: 'identification_records_track1',                    column: 'track1',  row: 0, clickable: true, hint: 'Click for query breakdown' },
  { id: 'identification_records_track2',                    column: 'track2',  row: 0, clickable: true, hint: 'Click for anchor list' },

  { id: 'identification_duplicates_removed_track1',         column: 'track1',  row: 1, clickable: true, hint: 'Click for duplicate list' },
  { id: 'identification_optional_queries_removed_track1',   column: 'track1',  row: 2, clickable: true, hint: 'Click for the Q15 list' },

  { id: 'identification_unique_records_track1',             column: 'track1',  row: 3, clickable: false },

  { id: 'cross_track_overlaps',                             column: 'branch',  row: 4, clickable: true, hint: 'Click for the 5 overlaps' },

  { id: 'screening_records_input_track1',                   column: 'track1',  row: 5, clickable: false },

  { id: 'included_studies_track2',                          column: 'track2',  row: 5, clickable: true, hint: 'Click for anchor list' },

  { id: 'screening_excluded_title_abstract_track1',         column: 'track1',  row: 6, clickable: true },
];

export const DIAGRAM_EDGES: DiagramEdgeSpec[] = [
  // Track 1 spine
  { from: 'identification_records_track1',                  to: 'identification_duplicates_removed_track1',       variant: 'main' },
  { from: 'identification_duplicates_removed_track1',       to: 'identification_optional_queries_removed_track1', variant: 'main' },
  { from: 'identification_optional_queries_removed_track1', to: 'identification_unique_records_track1',           variant: 'main' },

  // 312 → 5 overlaps → 22 anchors (branch off before Track 1 goes to screening)
  { from: 'identification_unique_records_track1',           to: 'cross_track_overlaps',                           label: 'reassigned to Track 2', variant: 'branch' },
  { from: 'cross_track_overlaps',                           to: 'included_studies_track2',                        variant: 'reassign' },

  // 312 → 307 (main flow continues after overlaps are peeled off)
  { from: 'identification_unique_records_track1',           to: 'screening_records_input_track1',                 label: 'minus overlaps', variant: 'main' },

  // Track 2 spine
  { from: 'identification_records_track2',                  to: 'included_studies_track2',                        variant: 'main' },

  // Screening
  { from: 'screening_records_input_track1',                 to: 'screening_excluded_title_abstract_track1',       variant: 'main' },
];
