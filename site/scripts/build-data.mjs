// Build-time data pipeline: reads CSVs on Google Drive and workspace .github/
// files, emits normalised JSON under public/data/. Called by `pnpm build:data`
// and by `pnpm predev`. Skipped in CI (SKIP_DATA_REBUILD=1); CI relies on the
// committed snapshot instead.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { parse as parseCsv } from 'csv-parse/sync';
import matter from 'gray-matter';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(SITE_ROOT, 'public', 'data');

if (process.env.SKIP_DATA_REBUILD === '1') {
  console.log('[build-data] SKIP_DATA_REBUILD=1, using committed snapshot');
  process.exit(0);
}

const DRIVE_ROOT = process.env.DRIVE_CONSENSUS_ROOT;
const AI_ROOT = process.env.DRIVE_AI_ASSISTANCE_ROOT;
if (!DRIVE_ROOT) throw new Error('DRIVE_CONSENSUS_ROOT missing in env');
if (!AI_ROOT) throw new Error('DRIVE_AI_ASSISTANCE_ROOT missing in env');

const LOGS_DIR = join(DRIVE_ROOT, 'logs');
const PRISMA_LOGS = join(LOGS_DIR, 'prisma-logs');
const NON_PRISMA_LOGS = join(LOGS_DIR, 'non-prisma-logs');
const ABSTRACTS_DIR = join(DRIVE_ROOT, 'abstracts');
const DECISIONS_DIR = join(DRIVE_ROOT, 'prisma-track2-inclusion-decisions');
const QUESTIONS_DIR = join(DRIVE_ROOT, 'questions');

const LABELS_FROZEN = (process.env.LABELS_FROZEN || 'false').toLowerCase() === 'true';

const manifest = {
  built_at: new Date().toISOString(),
  labels_frozen: LABELS_FROZEN,
  files_written: [],
  orphaned_abstracts: [],
  rejected_track2_decisions: [],
  filtered_ignored_rows: {},
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(join(OUT_DIR, 'wiki-pages'), { recursive: true });

  // ---- PRISMA logs ----
  const tally = await loadCsv(join(LOGS_DIR, 'prisma-tally.csv'));
  await write('prisma-tally.json', tally.map(row => ({
    ...row,
    node_order: toInt(row.node_order),
    count: toIntOrNull(row.count),
  })));

  const rows01a = await loadCsv(join(PRISMA_LOGS, '01a_identification_all.csv'));
  const active01a = filterActive(rows01a, '01a');
  await write('identification-01a.json', active01a.map(mapT1Hit));

  // Also emit the Q15-ignored subset so the "optional queries not operationalised"
  // drill-down has data to show.
  const ignored01a = rows01a.filter(r => {
    const s = (r.pipeline_status || '').trim().toLowerCase();
    return s.startsWith('ignored_');
  });
  await write('identification-01a-ignored.json', ignored01a.map(mapT1Hit));

  const rows01b = await loadCsv(join(PRISMA_LOGS, '01b_identification_track2_anchors.csv'));
  const mappedT2 = rows01b.map(mapT2Anchor);
  await write('identification-01b.json', mappedT2);

  const rows01c = await loadCsv(join(PRISMA_LOGS, '01c_identification_dedup.csv'));
  const active01c = filterActive(rows01c, '01c');
  await write('identification-01c.json', active01c.map(mapT1Unique));

  const rows2b = await loadCsv(join(PRISMA_LOGS, '2b_screening_excluded.csv'));
  const active2b = filterActive(rows2b, '2b');
  await write('screening-excluded-2b.json', active2b.map(mapScreeningExclusion));

  const ch3 = await loadCsv(join(NON_PRISMA_LOGS, 'ch3_methods_anchors.csv'));
  await write('non-prisma-ch3.json', ch3);

  const signposts = await loadCsv(join(NON_PRISMA_LOGS, 'signpost_citations.csv'));
  await write('non-prisma-signposts.json', signposts);

  // ---- Questions (derived from 01a's query_text field) ----
  const questions = await loadQuestions(rows01a);
  await write('questions.json', questions);

  // ---- Abstracts (filtered against 01c ∪ 01b ∪ Q15-ignored, joined for title fallback) ----
  const whitelistedStableIds = new Set([
    ...active01c.map(r => r.stable_id),
    ...rows01b.map(r => r.stable_id),
    ...ignored01a.map(r => r.stable_id),
  ]);
  const titleAuthorsByStableId = new Map();
  const inlineAbstractByStableId = new Map();
  // 01c holds the canonical Track 1 metadata; 01a (including ignored) carries
  // the inline abstract text pulled straight from the Consensus CSV export.
  for (const r of active01c) {
    if (!r.stable_id) continue;
    titleAuthorsByStableId.set(r.stable_id, {
      title: r.title || '',
      authors: r.authors || '',
      venue: r.venue || '',
      doi_url: r.doi_url || '',
    });
    if (r.abstract) inlineAbstractByStableId.set(r.stable_id, r.abstract);
  }
  for (const r of rows01a) {
    if (!r.stable_id) continue;
    if (!titleAuthorsByStableId.has(r.stable_id)) {
      titleAuthorsByStableId.set(r.stable_id, {
        title: r.title || '',
        authors: r.authors || '',
        venue: r.venue || '',
        doi_url: r.doi_url || '',
      });
    }
    if (r.abstract && !inlineAbstractByStableId.has(r.stable_id)) {
      inlineAbstractByStableId.set(r.stable_id, r.abstract);
    }
  }
  const abstracts = await loadAbstracts(
    whitelistedStableIds,
    titleAuthorsByStableId,
    inlineAbstractByStableId,
  );
  await write('abstracts.json', abstracts);

  // ---- Track 2 decisions (filtered against 01b anchor_ids, joined for metadata) ----
  const anchorIds = new Set(rows01b.map(r => r.anchor_id));
  const anchorMetaById = new Map();
  for (const r of mappedT2) {
    if (!r.anchor_id) continue;
    anchorMetaById.set(r.anchor_id, {
      stable_id: r.stable_id,
      title: r.title,
      authors: r.authors,
      year: r.year,
      first_author: r.first_author,
      research_unit: r.research_unit,
      unit_alignment: r.unit_alignment,
      psychology_adjacent: r.psychology_adjacent,
    });
  }
  const decisions = await loadTrack2Decisions(anchorIds, anchorMetaById);
  await write('track2-decisions.json', decisions);

  // ---- AI-assistance CSVs ----
  await copyAiAssistanceCsvs();

  // ---- Meta ----
  const meta = {
    release_version: process.env.VITE_RELEASE_VERSION || '0.0.0',
    orcid_id: process.env.VITE_ORCID_ID || '',
    zenodo_doi: process.env.VITE_ZENODO_DOI || '',
    repo_url: process.env.VITE_REPO_URL || '',
    snapshot_date: new Date().toISOString().slice(0, 10),
    git_commit_sha: gitSha(),
    labels_frozen: LABELS_FROZEN,
    orphaned_abstract_count: manifest.orphaned_abstracts.length,
    rejected_track2_count: manifest.rejected_track2_decisions.length,
  };
  await write('meta.json', meta);

  await write('.build-manifest.json', manifest);

  console.log(`[build-data] wrote ${manifest.files_written.length} JSON files to ${OUT_DIR}`);
  console.log(`[build-data] orphaned abstracts: ${manifest.orphaned_abstracts.length}`);
  console.log(`[build-data] rejected track2: ${manifest.rejected_track2_decisions.length}`);
  console.log(`[build-data] filtered ignored rows: ${JSON.stringify(manifest.filtered_ignored_rows)}`);
}

// ---------- helpers ----------

async function loadCsv(path) {
  if (!existsSync(path)) {
    console.warn(`[build-data] missing CSV: ${path}`);
    return [];
  }
  const text = await readFile(path, 'utf8');
  return parseCsv(text, { columns: true, bom: true, skip_empty_lines: true, trim: false });
}

function filterActive(rows, name) {
  const before = rows.length;
  const active = rows.filter(r => {
    const status = (r.pipeline_status || 'active').trim().toLowerCase();
    return status === 'active';
  });
  manifest.filtered_ignored_rows[name] = before - active.length;
  return active;
}

async function write(rel, data) {
  const target = join(OUT_DIR, rel);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(data, null, 2), 'utf8');
  manifest.files_written.push(rel);
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
function toIntOrNull(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function primaryQuery(queryIds) {
  const s = (queryIds || '').trim();
  if (!s) return '';
  return s.split('|')[0].trim();
}

function mapT1Hit(r) {
  return {
    ...r,
    year: toIntOrNull(r.year),
    citations: toIntOrNull(r.citations),
  };
}

function mapT1Unique(r) {
  return {
    ...r,
    hit_count: toInt(r.hit_count),
    year: toIntOrNull(r.year),
    citations: toIntOrNull(r.citations),
    primary_query_id: primaryQuery(r.query_ids),
  };
}

function mapT2Anchor(r) {
  // Alias raw 01b column names to the reader-oriented shape the site expects.
  // full_citation carries "Authors (Year). Title. Venue, ..." in APA style;
  // pull the title out with a tolerant regex that stops at the first sentence
  // boundary followed by an italic venue or comma.
  const title = parseTitleFromCitation(r.full_citation);
  const authors = parseAuthorsFromCitation(r.full_citation) || r.first_author || '';
  return {
    ...r,
    year: toIntOrNull(r.year),
    s2_citation_count: toIntOrNull(r.s2_citation_count),
    s2_influential_citations: toIntOrNull(r.s2_influential_citations),
    // Reader-facing aliases (leave originals in place for future consumers).
    title,
    authors,
    register_tag: r.register || '',
    journal_sjr_quartile: r.sjr_quartile || '',
    inclusion_decision_path: r.inclusion_decision_path || '',
  };
}

// "Authors (Year). Title of paper. Venue, 12(3), 45-67. https://doi.org/..."
function parseTitleFromCitation(citation) {
  if (!citation) return '';
  const m = citation.match(/\(\d{4}[a-z]?\)\.\s+([^.]+?[^.])\.\s+/);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}
function parseAuthorsFromCitation(citation) {
  if (!citation) return '';
  const m = citation.match(/^(.+?)\s+\(\d{4}[a-z]?\)/);
  return m ? m[1].trim() : '';
}

function mapScreeningExclusion(r) {
  return { ...r, year: toIntOrNull(r.year) };
}

async function loadQuestions(rows01a) {
  // Text source priority: canonical questions JSON > 01a's own query_text
  // column > truncated title reconstructed from the retrieval CSV filename.
  // Counts are always derived from 01a so the aggregation view stays in sync
  // with the identification funnel.
  const jsonTextMap = await loadQuestionsTextMap();
  const filenameFallback = await queryTextFromResultsFilenames();

  const byQ = new Map();
  for (const r of rows01a) {
    const q = r.query_id;
    if (!q) continue;
    const bucket = byQ.get(q) ?? { q_id: q, text: '', hits: [], stable_ids: new Set(), retrieval_date: '' };
    if (!bucket.text && r.query_text) bucket.text = r.query_text.trim();
    if (!bucket.retrieval_date && r.retrieval_date) bucket.retrieval_date = r.retrieval_date;
    bucket.hits.push(r);
    if (r.stable_id) bucket.stable_ids.add(r.stable_id);
    byQ.set(q, bucket);
  }
  return Array.from(byQ.values())
    .map(b => ({
      q_id: b.q_id,
      text: jsonTextMap.get(b.q_id) || b.text || filenameFallback.get(b.q_id) || '',
      retrieval_date: b.retrieval_date,
      results_returned: b.hits.length,
      unique_track1_hits: b.stable_ids.size,
      operationalised: true,
    }))
    .sort((a, b) => a.q_id.localeCompare(b.q_id, undefined, { numeric: true }));
}

async function loadQuestionsTextMap() {
  const map = new Map();
  if (!existsSync(QUESTIONS_DIR)) return map;
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(QUESTIONS_DIR)).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const txt = await readFile(join(QUESTIONS_DIR, f), 'utf8');
      const obj = JSON.parse(txt);
      const arr = Array.isArray(obj?.questions) ? obj.questions : Array.isArray(obj) ? obj : [];
      for (const q of arr) {
        const qid = (q?.query_id || q?.q_id || '').toString().toUpperCase();
        const text = (q?.text || '').toString().trim();
        if (qid && text) map.set(qid, text);
      }
    } catch (e) {
      console.warn(`[build-data] failed to parse questions ${f}: ${e.message}`);
    }
  }
  return map;
}

// Fallback for queries whose query_text field never made it into 01a
// (wave-2 exports for Q17..Q22 had a different Consensus schema): reconstruct
// a truncated query title from the retrieval CSV filename, which encodes
// underscores-for-spaces and is truncated at ~60 chars.
async function queryTextFromResultsFilenames() {
  const { readdir } = await import('node:fs/promises');
  const map = new Map();
  const csvDir = join(DRIVE_ROOT, 'query-results', 'csv');
  if (!existsSync(csvDir)) return map;
  const files = await readdir(csvDir);
  for (const f of files) {
    if (!f.endsWith('.csv')) continue;
    const m = f.match(/^(Q\d{2})_(.+?)\.csv$/i);
    if (!m) continue;
    const q = m[1].toUpperCase();
    const humanised = m[2]
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Add trailing ellipsis so the reader sees this is a truncated title.
    const text = humanised + '…';
    map.set(q, text);
  }
  return map;
}

async function loadAbstracts(whitelist, titleAuthorsByStableId, inlineAbstractByStableId = new Map()) {
  const { readdir } = await import('node:fs/promises');
  const out = new Map();

  // 1. Parse every abstract markdown file on Drive. Keep only those whose
  //    stable_id is in the whitelist.
  if (existsSync(ABSTRACTS_DIR)) {
    const files = (await readdir(ABSTRACTS_DIR)).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const parsed = parseAbstractFilename(f);
      if (!parsed) continue;
      if (!whitelist.has(parsed.stable_id)) {
        manifest.orphaned_abstracts.push(f);
        continue;
      }
      const raw = await readFile(join(ABSTRACTS_DIR, f), 'utf8');
      const md = parseAbstractMarkdown(raw);
      const fallback = titleAuthorsByStableId.get(parsed.stable_id) ?? {};
      out.set(parsed.stable_id, {
        stable_id: parsed.stable_id,
        year: md.year || parsed.year,
        first_surname: parsed.surname,
        title: md.title || fallback.title || '',
        authors_apa: md.authors || fallback.authors || '',
        venue: md.venue || fallback.venue || '',
        abstract_text: md.body,
        abstract_src: md.abstract_src || 'markdown',
        doi_url: md.doi || fallback.doi_url || '',
        file_name: f,
      });
    }
  }

  // 2. Fill in the gaps: every whitelist stable_id without a markdown file
  //    gets a synthesised record built from the log-inline metadata plus
  //    the abstract text embedded on the 01a row. This covers Q15 rows
  //    (fetch_abstracts skipped them as 2b exclusions) and the 5 cross-track
  //    overlaps (fetch_abstracts skipped them as Track 2 anchors).
  for (const sid of whitelist) {
    if (out.has(sid)) continue;
    const meta = titleAuthorsByStableId.get(sid);
    const abstract = inlineAbstractByStableId.get(sid);
    if (!meta && !abstract) continue;
    out.set(sid, {
      stable_id: sid,
      year: '',
      first_surname: '',
      title: meta?.title ?? '',
      authors_apa: meta?.authors ?? '',
      venue: meta?.venue ?? '',
      abstract_text: abstract ?? '',
      abstract_src: 'log_inline',
      doi_url: meta?.doi_url ?? '',
      file_name: '',
    });
  }

  return Array.from(out.values());
}

function parseAbstractMarkdown(raw) {
  // Abstract markdowns follow the format:
  //   # Title as an H1
  //   - **field**: value
  //   - **field**: value
  //   ...
  //   ## Abstract
  //   <abstract prose>
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const meta = {};
  let title = '';
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!title) {
      const h1 = line.match(/^#\s+(.+?)\s*$/);
      if (h1) { title = h1[1]; continue; }
    }
    const bullet = line.match(/^\s*-\s+\*\*(.+?)\*\*\s*:\s*(.+?)\s*$/);
    if (bullet) {
      meta[bullet[1].trim().toLowerCase()] = bullet[2].trim();
      continue;
    }
    if (/^##\s+abstract/i.test(line)) {
      bodyStart = i + 1;
      break;
    }
  }

  const body = lines.slice(bodyStart).join('\n')
    // strip leftover H2 dividers and horizontal rules
    .replace(/^\s*---+\s*$/gm, '')
    .trim();

  return {
    title,
    authors: meta['authors'] || '',
    year: meta['year'] || '',
    venue: meta['venue'] || '',
    doi: meta['doi'] || '',
    abstract_src: meta['fetched_at'] ? 'consensus_csv' : '',
    body,
  };
}

function parseAbstractFilename(f) {
  const m = f.match(/^(\d{4})_([^_]+)_([0-9a-f]{8})\.md$/);
  if (!m) return null;
  return { year: m[1], surname: m[2], stable_id: m[3] };
}

function extractBody(content) {
  // Kept for backwards compatibility only; the new parser handles bodies.
  const parts = content.split(/^-{3,}$|^\*{3,}$/m);
  return (parts.length > 1 ? parts.slice(1).join('\n') : content).trim();
}

async function loadTrack2Decisions(whitelist, anchorMetaById) {
  const { readdir } = await import('node:fs/promises');
  if (!existsSync(DECISIONS_DIR)) return [];
  const files = (await readdir(DECISIONS_DIR)).filter(f => f.endsWith('.md'));
  const out = [];
  for (const f of files) {
    const raw = await readFile(join(DECISIONS_DIR, f), 'utf8');
    const anchor_id = parseAnchorFromFilename(f);
    if (!anchor_id || !whitelist.has(anchor_id)) {
      manifest.rejected_track2_decisions.push(f);
      continue;
    }
    // Decision markdowns follow: "# T2-XXX — Authors (Year), \"Title\"" then
    // free-form prose. Parse the H1 for authors/year/title; fall back to
    // 01b if the H1 does not match.
    const parsed = parseDecisionH1(raw);
    const meta = anchorMetaById.get(anchor_id) ?? {};
    out.push({
      stable_id: meta.stable_id || '',
      anchor_id,
      title: parsed.title || meta.title || '',
      authors: parsed.authors || meta.authors || meta.first_author || '',
      year: parsed.year || meta.year || null,
      research_unit: meta.research_unit || '',
      unit_alignment: meta.unit_alignment || '',
      psychology_adjacent: meta.psychology_adjacent || '',
      rationale_md: raw.trim(),
    });
  }
  return out;
}

function parseDecisionH1(raw) {
  const line = raw.split(/\r?\n/, 1)[0] || '';
  // "# T2-A01 — Acemoglu & Restrepo (2018), \"Title\""
  const m = line.match(/^#\s*T2-\w+\s*[—-]\s*(.+?)\s*\((\d{4})\)\s*,\s*["“](.+?)["”]/);
  if (!m) return { title: '', authors: '', year: null };
  return { authors: m[1].trim(), year: parseInt(m[2], 10), title: m[3].trim() };
}

function parseAnchorFromFilename(f) {
  const m = f.match(/^(T2-[A-Z]\d{2})/);
  return m ? m[1] : null;
}

async function copyAiAssistanceCsvs() {
  const { readdir, copyFile } = await import('node:fs/promises');
  if (!existsSync(AI_ROOT)) {
    console.warn(`[build-data] missing AI_ASSISTANCE_ROOT: ${AI_ROOT}`);
    return;
  }
  const publicAiDir = join(OUT_DIR, 'ai-assistance');
  await mkdir(publicAiDir, { recursive: true });

  const files = await readdir(AI_ROOT);
  const gated = new Set(['hand_labelled_sample.csv', 'human_decisions.csv']);
  const public_csvs = files.filter(f =>
    (f.endsWith('.csv') || f.endsWith('.json') || f.endsWith('.md')) &&
    (!gated.has(f) || LABELS_FROZEN)
  );
  for (const f of public_csvs) {
    await copyFile(join(AI_ROOT, f), join(publicAiDir, f));
    manifest.files_written.push(`ai-assistance/${f}`);
  }
  console.log(`[build-data] copied ${public_csvs.length} ai-assistance file(s)`);
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: SITE_ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

// ---- run ----
main().catch(err => {
  console.error('[build-data] FAILED');
  console.error(err);
  process.exit(1);
});
