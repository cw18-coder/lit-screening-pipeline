// Prebuild gate: in CI (SKIP_DATA_REBUILD=1), skip data regeneration and
// require the committed public/data/ snapshot. Locally, regenerate.

if (process.env.SKIP_DATA_REBUILD === '1') {
  console.log('[prebuild] SKIP_DATA_REBUILD=1, using committed snapshot');
  process.exit(0);
}

import('node:child_process').then(({ spawnSync }) => {
  const opts = { stdio: 'inherit', shell: true };
  const dataRun = spawnSync('node scripts/build-data.mjs', opts);
  if (dataRun.status !== 0) process.exit(dataRun.status);
  const wikiRun = spawnSync('node scripts/build-wiki.mjs', opts);
  if (wikiRun.status !== 0) process.exit(wikiRun.status);
});
