export function About() {
  const version = import.meta.env.VITE_RELEASE_VERSION ?? 'dev';
  const doi = import.meta.env.VITE_ZENODO_DOI;
  const orcid = import.meta.env.VITE_ORCID_ID;
  const repo = import.meta.env.VITE_REPO_URL;

  return (
    <div className="route-view">
      <h1>About</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: '78ch' }}>
        This site is the interactive companion to the correctness-wedge PRISMA review that is
        reported in Chapter 2 of the ESGCI DBA thesis. Every number and rationale on the site
        matches the corresponding count in the thesis appendix.
      </p>

      <h2>Release</h2>
      <ul>
        <li><b>Version:</b> {version}</li>
        {doi && (
          <li>
            <b>Zenodo DOI:</b>{' '}
            <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener">
              {doi}
            </a>
          </li>
        )}
        {orcid && (
          <li>
            <b>Author ORCID:</b>{' '}
            <a href={`https://orcid.org/${orcid}`} target="_blank" rel="noopener">
              {orcid}
            </a>
          </li>
        )}
        {repo && (
          <li>
            <b>Repository:</b>{' '}
            <a href={repo} target="_blank" rel="noopener">
              {repo}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
