// Reads .github/ markdown from the workspace, emits normalised JSON under
// public/data/wiki-index.json and public/data/wiki-pages/<page_id>.json.
//
// Categories:
//   skills        <root>/skills/*/SKILL.md
//   instructions  <root>/instructions/*.instructions.md
//   agents        <root>/agents/*.agent.md
//   root          <root>/copilot-instructions.md

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(SITE_ROOT, 'public', 'data');
const PAGES_DIR = join(OUT_DIR, 'wiki-pages');

if (process.env.SKIP_DATA_REBUILD === '1') {
  console.log('[build-wiki] SKIP_DATA_REBUILD=1, using committed snapshot');
  process.exit(0);
}

const GITHUB_ROOT = process.env.WORKSPACE_GITHUB_ROOT;
if (!GITHUB_ROOT) throw new Error('WORKSPACE_GITHUB_ROOT missing in env');

const SECTIONS = [
  { section: 'skills',       label: 'Skills',         glob: (root) => join(root, 'skills'),
    walk: walkSkillDirs },
  { section: 'instructions', label: 'Instructions',   glob: (root) => join(root, 'instructions'),
    walk: walkInstructionDir },
  { section: 'agents',       label: 'Agents',         glob: (root) => join(root, 'agents'),
    walk: walkAgentDir },
  { section: 'root',         label: 'Copilot instructions', glob: (root) => root,
    walk: walkRootDir },
];

async function main() {
  await mkdir(PAGES_DIR, { recursive: true });
  const index = { sections: [] };

  for (const s of SECTIONS) {
    const dir = s.glob(GITHUB_ROOT);
    if (!existsSync(dir)) {
      console.warn(`[build-wiki] section directory not found: ${dir}`);
      continue;
    }
    const pages = await s.walk(dir, s.section);
    for (const page of pages) {
      await writeFile(
        join(PAGES_DIR, `${page.page_id}.json`),
        JSON.stringify(page, null, 2),
        'utf8'
      );
    }
    index.sections.push({
      section: s.section,
      label: s.label,
      pages: pages.map(({ page_id, title, description }) => ({ page_id, title, description })),
    });
    console.log(`[build-wiki] ${s.section}: ${pages.length} page(s)`);
  }

  await writeFile(join(OUT_DIR, 'wiki-index.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log(`[build-wiki] wrote wiki-index.json (${index.sections.length} sections)`);
}

async function walkSkillDirs(root, section) {
  const out = [];
  const entries = await readdir(root);
  for (const skillName of entries) {
    const skillPath = join(root, skillName);
    if (!statSync(skillPath).isDirectory()) continue;
    const skillFile = join(skillPath, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    out.push(await parsePage(skillFile, section, `skill-${skillName}`));
  }
  return out;
}

async function walkInstructionDir(root, section) {
  const out = [];
  const files = (await readdir(root)).filter(f => f.endsWith('.instructions.md'));
  for (const f of files) {
    const page_id = `instr-${f.replace(/\.instructions\.md$/, '')}`;
    out.push(await parsePage(join(root, f), section, page_id));
  }
  return out;
}

async function walkAgentDir(root, section) {
  const out = [];
  const files = (await readdir(root)).filter(f => f.endsWith('.agent.md'));
  for (const f of files) {
    const page_id = `agent-${f.replace(/\.agent\.md$/, '')}`;
    out.push(await parsePage(join(root, f), section, page_id));
  }
  return out;
}

async function walkRootDir(root, section) {
  const out = [];
  const candidate = join(root, 'copilot-instructions.md');
  if (existsSync(candidate)) {
    out.push(await parsePage(candidate, section, 'copilot-instructions'));
  }
  return out;
}

async function parsePage(filePath, section, page_id) {
  const raw = await readFile(filePath, 'utf8');
  const { data, content } = matter(raw);
  const outboundLinks = extractLinks(content);
  return {
    page_id,
    section,
    title: data.title || data.name || pageTitle(content) || basename(filePath),
    description: data.description || '',
    applies_to: data.applyTo || null,
    frontmatter: data,
    body_md: content.trim(),
    outbound_links: outboundLinks,
    source_path: filePath.replace(GITHUB_ROOT, '<workspace>/.github'),
  };
}

function pageTitle(md) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

function extractLinks(md) {
  const links = new Set();
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(md)) != null) {
    links.add(m[1]);
  }
  return Array.from(links);
}

main().catch(err => {
  console.error('[build-wiki] FAILED');
  console.error(err);
  process.exit(1);
});
