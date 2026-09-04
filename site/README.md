# site — PRISMA + wiki front-end

Static React + Vite + TypeScript site that ships as the front-end of the
`lit-screening-pipeline` release. Two parts:

1. **Interactive PRISMA funnel** rendered from the identification and
   screening CSVs on Google Drive.
2. **Browsable wiki** of the workspace `.github/` skills, instructions,
   agents, and copilot-instructions.

Full architectural blueprint lives at
`G:\My Drive\ESGCIDBA\correctness-wedge\thesis-review-method\site\DESIGN.md`
in the author's Google Drive.

## Local development

Prereqs: Node 20 LTS, pnpm 9, mounted Google Drive at `G:\`, workspace
repo at the path referenced in `.env`.

```powershell
# 1. Copy the env template and edit if needed.
Copy-Item .env.example .env

# 2. Install deps against the Microsoft NPM proxy.
pnpm install

# 3. Regenerate JSON snapshots from Drive + workspace .github/.
pnpm build:data
pnpm build:wiki

# 4. Start dev server.
pnpm dev
```

Open `http://localhost:5173/` (or the base path shown in the terminal).

## Production build

```powershell
$env:SKIP_DATA_REBUILD = '1'  # rely on the committed snapshot
pnpm build
pnpm preview
```

`SKIP_DATA_REBUILD=1` skips regenerating `public/data/**` and trusts the
committed JSON snapshot, which is what CI does.

## Data pipeline

Two Node scripts under `scripts/`:

| Script | Purpose |
|---|---|
| `build-data.mjs` | Reads the seven PRISMA log CSVs, the abstracts corpus, the Track 2 decisions, the questions JSON, and the ai-assistance CSVs. Filters by `pipeline_status = 'active'`. Gates `hand_labelled_sample.csv` and `human_decisions.csv` behind `LABELS_FROZEN=true`. Writes to `public/data/`. |
| `build-wiki.mjs` | Walks the workspace `.github/` (skills / instructions / agents / copilot-instructions), parses frontmatter, extracts outbound links, writes one JSON per page plus a tree index. |

Both scripts are idempotent; committing the resulting `public/data/**` gives
CI a hermetic build that doesn't need Drive access.

## Deployment

GitHub Actions workflow at `.github/workflows/deploy.yml` runs `pnpm build`
against the committed snapshot and publishes to GitHub Pages under the
`/lit-screening-pipeline/` base path.

The workflow is triggered by `main` pushes under `site/**` and by manual
`workflow_dispatch`. No scheduled runs.

## Structure

```
site/
├── .env.example
├── .npmrc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── scripts/
│   ├── build-data.mjs
│   ├── build-wiki.mjs
│   └── gate-prebuild.mjs
├── public/
│   └── data/            # COMMITTED snapshot, regenerated locally
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles/
    │   ├── tokens.css
    │   └── global.css
    ├── components/
    │   └── Header.*
    ├── routes/
    │   ├── Home.tsx
    │   ├── Prisma.tsx
    │   ├── PrismaNode.tsx
    │   ├── Wiki.tsx
    │   ├── WikiPage.tsx
    │   ├── Search.tsx
    │   └── About.tsx
    └── types/
        └── prisma.ts
```

## Milestones

- **M0** ✅ Scaffold, styling tokens, app shell.
- **M1** ✅ Data pipeline. `public/data/` snapshot generated.
- **M2** ✅ PRISMA diagram + primitive components.
- **M3** ✅ Node drill-downs (query-aggregation, duplicates, Q15-ignored, overlaps, Track 2 anchors, exclusions-by-code).
- **M4** ✅ Wiki tree + page renderer. Interactive screening-flow diagram slotted on the AI-assisted-screening page still to come.
- **M5** ⏳ Search + polish.
- **M6** ⏳ A11y audit.
- **M7** ⏳ Release.
