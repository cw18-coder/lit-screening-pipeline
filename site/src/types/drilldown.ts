export type DrilldownVariant =
  | 'query_aggregation'    // 440 — group by Consensus query
  | 'duplicates'           // 108 — papers surfaced by multiple queries
  | 'q15_ignored'          // 20 — Q15 removed, with decision text
  | 'overlaps'             // 5 — cross-track overlaps
  | 'track2_anchors'       // 22 — anchor list with decision viewer
  | 'transit'              // 312, 307, screening-pending — no click-through
  | 'reserved';            // screening-excluded pending AI screening

export interface DrilldownConfig {
  variant: DrilldownVariant;
  intro?: string;
}

export const DRILLDOWN_CONFIG: Record<string, DrilldownConfig> = {
  identification_records_track1: {
    variant: 'query_aggregation',
    intro:
      'Every reference identified by the Consensus.app queries, grouped by query. Click a query to see the papers it returned; click a paper to read its abstract.',
  },

  identification_duplicates_removed_track1: {
    variant: 'duplicates',
    intro:
      'Papers that were returned by more than one Consensus query. Each row shows the queries that surfaced the paper — the record itself was kept once, the extra hits were removed at deduplication.',
  },

  identification_optional_queries_removed_track1: {
    variant: 'q15_ignored',
    intro:
      'Records that came from an optional Consensus query the reviewer chose not to operationalise. Reasoning is shown below the paper list.',
  },

  identification_unique_records_track1:  { variant: 'transit' },
  screening_records_input_track1:        { variant: 'transit' },
  screening_records_pending_track1:      { variant: 'transit' },
  eligibility_sought_full_text_track1:   { variant: 'transit' },
  eligibility_not_retrieved_track1:      { variant: 'transit' },
  eligibility_assessed_full_text_track1: { variant: 'transit' },
  eligibility_excluded_full_text_track1: { variant: 'transit' },
  included_studies_track1:               { variant: 'transit' },
  included_studies_total:                { variant: 'transit' },

  cross_track_overlaps: {
    variant: 'overlaps',
    intro:
      'Five references that were both surfaced by a Consensus query and independently selected as Track 2 anchors. For counting purposes they are attributed to Track 2 and bypass the title-and-abstract screening step.',
  },

  identification_records_track2: {
    variant: 'track2_anchors',
    intro:
      'The 22 anchor references selected purposively for their theoretical or methodological weight. Click any row to read the full inclusion rationale.',
  },

  included_studies_track2: {
    variant: 'track2_anchors',
    intro:
      'All 22 Track 2 anchors are included by design. Click a row to see the reasoning that anchored the reference.',
  },

  screening_excluded_title_abstract_track1: {
    variant: 'reserved',
  },
};
