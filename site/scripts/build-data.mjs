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
  await write('identification-01b.json', rows01b.map(mapT2Anchor));

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

  // ---- Questions ----
  const questions = await loadQuestions();
  await write('questions.json', questions);

  // ---- Abstracts (filtered against 01c ∪ 01b) ----
  const whitelistedStableIds = new Set([
    ...active01c.map(r => r.stable_id),
    ...rows01b.map(r => r.stable_id),
  ]);
  const abstracts = await loadAbstracts(whitelistedStableIds);
  await write('abstracts.json', abstracts);

  // ---- Track 2 decisions (filtered against 01b anchor_ids) ----
  const anchorIds = new Set(rows01b.map(r => r.anchor_id));
  const decisions = await loadTrack2Decisions(anchorIds);
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
  return {
    ...r,
    year: toIntOrNull(r.year),
    s2_citation_count: toIntOrNull(r.s2_citation_count),
    s2_influential_citations: toIntOrNull(r.s2_influential_citations),
  };
}

function mapScreeningExclusion(r) {
  return { ...r, year: toIntOrNull(r.year) };
}

async function loadQuestions() {
  if (!existsSync(QUESTIONS_DIR)) return [];
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(QUESTIONS_DIR)).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const txt = await readFile(join(QUESTIONS_DIR, f), 'utf8');
      const obj = JSON.parse(txt);
      if (Array.isArray(obj?.questions)) {
        out.push(...obj.questions);
      } else if (Array.isArray(obj)) {
        out.push(...obj);
      }
    } catch (e) {
      console.warn(`[build-data] failed to parse questions ${f}: ${e.message}`);
    }
  }
  return out;
}

async function loadAbstracts(whitelist) {
  const { readdir } = await import('node:fs/promises');
  if (!existsSync(ABSTRACTS_DIR)) return [];
  const files = (await readdir(ABSTRACTS_DIR)).filter(f => f.endsWith('.md'));
  const out = [];
  for (const f of files) {
    const parsed = parseAbstractFilename(f);
    if (!parsed) continue;
    if (!whitelist.has(parsed.stable_id)) {
      manifest.orphaned_abstracts.push(f);
      continue;
    }
    const raw = await readFile(join(ABSTRACTS_DIR, f), 'utf8');
    const { data, content } = matter(raw);
    out.push({
      stable_id: parsed.stable_id,
      year: parsed.year,
      first_surname: parsed.surname,
      title: data.title || '',
      authors_apa: data.authors_apa || data.authors || '',
      abstract_text: extractBody(content),
      abstract_src: data.abstract_src || '',
      doi_url: data.doi_url || '',
      file_name: f,
    });
  }
  return out;
}

function parseAbstractFilename(f) {
  const m = f.match(/^(\d{4})_([^_]+)_([0-9a-f]{8})\.md$/);
  if (!m) return null;
  return { year: m[1], surname: m[2], stable_id: m[3] };
}

function extractBody(content) {
  // Strip a leading provenance block (delimited by "---" or "***") if present.
  const parts = content.split(/^-{3,}$|^\*{3,}$/m);
  return (parts.length > 1 ? parts.slice(1).join('\n') : content).trim();
}

async function loadTrack2Decisions(whitelist) {
  const { readdir } = await import('node:fs/promises');
  if (!existsSync(DECISIONS_DIR)) return [];
  const files = (await readdir(DECISIONS_DIR)).filter(f => f.endsWith('.md'));
  const out = [];
  for (const f of files) {
    const raw = await readFile(join(DECISIONS_DIR, f), 'utf8');
    const { data, content } = matter(raw);
    const anchor_id = data.anchor_id || parseAnchorFromFilename(f);
    if (!anchor_id || !whitelist.has(anchor_id)) {
      manifest.rejected_track2_decisions.push(f);
      continue;
    }
    const decision = (data.decision || 'accepted').toLowerCase();
    if (decision === 'rejected') {
      manifest.rejected_track2_decisions.push(f);
      continue;
    }
    out.push({
      stable_id: data.stable_id || '',
      anchor_id,
      title: data.title || '',
      authors: data.authors || '',
      year: toIntOrNull(data.year),
      research_unit: data.research_unit || '',
      unit_alignment: data.unit_alignment || '',
      psychology_adjacent: data.psychology_adjacent || '',
      rationale_md: content.trim(),
    });
  }
  return out;
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
