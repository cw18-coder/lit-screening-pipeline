import type { AbstractRecord, Track1Hit, Track1UniqueRef, Track2Anchor, ScreeningExclusion } from './prisma';

// A drill-down config maps a PRISMA node to what the page should show.
// Kept in TS (not JSON) so type inference and column render functions
// remain terse.

export type DrilldownSource =
  | 'identification-01a'
  | 'identification-01b'
  | 'identification-01c'
  | 'screening-excluded-2b'
  | 'track2-decisions'
  | 'none';

export interface DrilldownConfig {
  node_id: string;
  source: DrilldownSource;
  intro?: string;
  columns?: string[];
  filter?: (row: unknown) => boolean;
  extraPanels?: Array<'query_barchart' | 'track2_overlap_table' | 'sanchez_note'>;
}

// Row-type discriminators for the drill-down page.
export type DrilldownRow =
  | Track1Hit
  | Track1UniqueRef
  | Track2Anchor
  | ScreeningExclusion
  | AbstractRecord;

export const DRILLDOWN_CONFIG: Record<string, DrilldownConfig> = {
  identification_records_track1: {
    node_id: 'identification_records_track1',
    source: 'identification-01a',
    intro:
      'Every Track 1 identification hit — one row per (paper, Consensus query) pair, active-only. Sortable by query, year, or venue.',
    columns: ['query_id', 'title', 'authors', 'year', 'venue', 'doi_url'],
    extraPanels: ['query_barchart'],
  },

  identification_duplicates_removed_track1: {
    node_id: 'identification_duplicates_removed_track1',
    source: 'identification-01a',
    intro:
      'The 108 intra-Track-1 duplicate hits: same paper returned by multiple Consensus queries. Grouped by canonical dedup key. Below shows all 01a rows; sort by DOI or title to see the duplicates that collapsed into a single 01c row.',
    columns: ['query_id', 'title', 'authors', 'year', 'doi_url'],
  },

  identification_optional_queries_removed_track1: {
    node_id: 'identification_optional_queries_removed_track1',
    source: 'identification-01a',
    intro:
      'The 20 Q15 rows marked pipeline_status=ignored_optional_q15. Q15 was pre-specified as optional in the search protocol; the reviewer decided post-retrieval not to operationalise it. Rows retained here for audit; excluded from every downstream count.',
    columns: ['title', 'authors', 'year', 'venue', 'doi_url'],
    extraPanels: ['sanchez_note'],
  },

  identification_unique_records_track1: {
    node_id: 'identification_unique_records_track1',
    source: 'identification-01c',
    intro:
      'Every unique Track 1 reference after intra-Track-1 dedup. Includes Track 2 overlaps (5 rows carrying a non-empty track2_status); these are shown here for audit but bypass screening.',
    columns: ['primary_query_id', 'title', 'authors', 'year', 'venue', 'track2_status', 'doi_url'],
  },

  cross_track_overlaps: {
    node_id: 'cross_track_overlaps',
    source: 'identification-01c',
    filter: (r) => Boolean((r as Track1UniqueRef).track2_status),
    intro:
      'The 5 references that appear in both 01c (Track 1 dedup) and 01b (Track 2 anchors). These are reassigned to Track 2 for the funnel and do not enter title-abstract screening — their inclusion is anchored by the Track 2 purposive-selection decision.',
    columns: ['track2_status', 'title', 'authors', 'year', 'doi_url'],
    extraPanels: ['track2_overlap_table'],
  },

  screening_records_input_track1: {
    node_id: 'screening_records_input_track1',
    source: 'identification-01c',
    filter: (r) => !(r as Track1UniqueRef).track2_status,
    intro:
      'The 307 records that enter title-abstract screening: unique after dedup (312) minus 5 Track 2 overlaps.',
    columns: ['primary_query_id', 'title', 'authors', 'year', 'venue', 'doi_url'],
  },

  screening_excluded_title_abstract_track1: {
    node_id: 'screening_excluded_title_abstract_track1',
    source: 'screening-excluded-2b',
    intro:
      'Reserved for AI-adjudicated + human-calibrated screening exclusions. Populates after the 5-fold CV run against the labelling sample. The 19 rows previously here (Q15 en-bloc) were reclassified as pre-screening optional-query removals; see the corresponding node.',
    columns: ['excluded_at_stage', 'title', 'authors', 'year', 'exclusion_reason', 'doi_url'],
  },

  identification_records_track2: {
    node_id: 'identification_records_track2',
    source: 'identification-01b',
    intro:
      'The 22 Track 2 anchors, purposively selected under the register-tagged process. Each row links to its inclusion decision markdown.',
    columns: ['anchor_id', 'title', 'authors', 'year', 'register_tag', 'journal_sjr_quartile', 'doi_url'],
  },

  included_studies_track2: {
    node_id: 'included_studies_track2',
    source: 'identification-01b',
    intro:
      'All 22 Track 2 anchors are included by purposive-selection design. Full inclusion decision rationales are visible when a row is clicked.',
    columns: ['anchor_id', 'title', 'authors', 'year', 'register_tag'],
  },

  // Placeholder configs for nodes still awaiting data.
  screening_records_pending_track1: { node_id: 'screening_records_pending_track1', source: 'none' },
  eligibility_sought_full_text_track1: { node_id: 'eligibility_sought_full_text_track1', source: 'none' },
  eligibility_not_retrieved_track1: { node_id: 'eligibility_not_retrieved_track1', source: 'none' },
  eligibility_assessed_full_text_track1: { node_id: 'eligibility_assessed_full_text_track1', source: 'none' },
  eligibility_excluded_full_text_track1: { node_id: 'eligibility_excluded_full_text_track1', source: 'none' },
  included_studies_track1: { node_id: 'included_studies_track1', source: 'none' },
  included_studies_total: { node_id: 'included_studies_total', source: 'none' },
};
