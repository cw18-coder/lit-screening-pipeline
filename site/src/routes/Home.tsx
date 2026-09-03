export function Home() {
  return (
    <div className="route-view">
      <h1>Correctness-wedge review</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '78ch' }}>
        Interactive PRISMA funnel and .github/ wiki for the correctness-wedge review of the
        ESGCI DBA thesis. Numbers on this site match the counts reported in the thesis
        methodology chapter and appendix; the site is the interactive verification layer.
      </p>
      <hr className="sep" />
      <p style={{ color: 'var(--ink-mute)' }}>
        Content is regenerated at build time from Google Drive log CSVs and workspace .github/ markdown.
        Run <code>pnpm build:data &amp;&amp; pnpm build:wiki</code> to refresh the local snapshot.
      </p>
    </div>
  );
}
