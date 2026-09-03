// PRISMA and screening data types. Mirrored by zod schemas so the JSON payloads
// validated once at boot are then trusted throughout the app.

export type PrismaStage = 'identification' | 'screening' | 'eligibility' | 'included';
export type Track = 'track1' | 'track2' | 'combined';

export interface PrismaTallyNode {
  stable_id: string;
  node_order: number;
  prisma_stage: PrismaStage;
  track: Track;
  node_id: string;
  label: string;
  count: number | null;
  source_log: string;
  last_updated: string;
  notes: string;
}

export interface Track1Hit {
  stable_id: string;
  ref_id: string;
  query_id: string;
  wave: string;
  retrieval_date: string;
  authors: string;
  year: number | null;
  title: string;
  venue: string;
  doi_url: string;
  abstract: string;
  takeaway: string;
  study_type: string;
  journal_sjr_quartile: string;
  consensus_link: string;
  citations: number | null;
  pipeline_status: string;
}

export interface Track1UniqueRef {
  stable_id: string;
  unique_ref_id: string;
  hit_count: number;
  query_ids: string;
  primary_query_id: string;
  authors: string;
  year: number | null;
  title: string;
  venue: string;
  doi_url: string;
  dedup_key: string;
  track2_status: string;
  abstract: string;
  takeaway: string;
  study_type: string;
  journal_sjr_quartile: string;
  consensus_link: string;
  citations: number | null;
  pipeline_status: string;
}

export interface Track2Anchor {
  stable_id: string;
  anchor_id: string;
  authors: string;
  year: number | null;
  title: string;
  venue: string;
  doi_url: string;
  register_tag: string;
  s2_citation_count: number | null;
  s2_influential_citations: number | null;
  journal_sjr_quartile: string;
  inclusion_decision_path: string;
}

export interface ScreeningExclusion {
  stable_id: string;
  unique_ref_id: string;
  authors: string;
  year: number | null;
  title: string;
  venue: string;
  doi_url: string;
  query_ids: string;
  excluded_at_stage: string;
  exclusion_reason: string;
  excluded_date: string;
  pipeline_status: string;
}

export interface ConsensusQuestion {
  q_id: string;
  text: string;
  retrieval_date: string;
  results_returned: number;
  unique_track1_hits: number;
  operationalised: boolean;
  notes: string;
}

export interface AbstractRecord {
  stable_id: string;
  year: string;
  first_surname: string;
  title: string;
  authors_apa: string;
  abstract_text: string;
  abstract_src: string;
  doi_url: string;
  file_name: string;
}

export interface Track2Decision {
  stable_id: string;
  anchor_id: string;
  title: string;
  authors: string;
  year: number | null;
  research_unit: string;
  unit_alignment: string;
  psychology_adjacent: string;
  rationale_md: string;
}

export interface SiteMeta {
  release_version: string;
  orcid_id: string;
  zenodo_doi: string;
  repo_url: string;
  snapshot_date: string;
  git_commit_sha: string;
  labels_frozen: boolean;
  orphaned_abstract_count: number;
  rejected_track2_count: number;
}

export interface WikiPage {
  page_id: string;
  section: 'skills' | 'instructions' | 'agents' | 'root';
  title: string;
  description: string;
  applies_to: string | null;
  body_md: string;
  outbound_links: string[];
}

export interface WikiIndex {
  sections: Array<{
    section: WikiPage['section'];
    label: string;
    pages: Array<Pick<WikiPage, 'page_id' | 'title' | 'description'>>;
  }>;
}
