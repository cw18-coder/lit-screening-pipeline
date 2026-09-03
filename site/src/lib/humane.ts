// Reader-friendly source-log labels. Never expose file paths or "computed"
// expressions to the reader — the raw values are audit metadata, not UI.
const SOURCE_LABELS: Record<string, string> = {
  '01a_identification_all.csv': 'Track 1 identification log',
  '01b_identification_track2_anchors.csv': 'Track 2 anchors log',
  '01c_identification_dedup.csv': 'Track 1 unique-references log',
  '2b_screening_excluded.csv': 'Screening exclusions log',
  'ch3_methods_anchors.csv': 'Chapter 3 methodology anchors',
  'signpost_citations.csv': 'Signpost citations',
};

export function humaneSourceLabel(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (SOURCE_LABELS[trimmed]) return SOURCE_LABELS[trimmed];
  // Suppress developer-facing phrasings ("computed: 01a - 01c" etc.).
  if (/^computed[:\s]/i.test(trimmed)) return null;
  if (/\.csv$/i.test(trimmed)) return trimmed.replace(/\.csv$/i, '').replace(/_/g, ' ');
  return null;
}
