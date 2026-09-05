import { Link } from 'react-router-dom';
import { Callout } from '../components/Callout';

// Wiki index scoped down to a single reachable page while the rest of the
// .github/ browsable rendering is under review.
export function Wiki() {
  return (
    <div className="route-view">
      <h1>.github/ wiki</h1>
      <Callout variant="accent-2" title="Under review.">
        {' '}The full wiki browser is being reworked. In the meantime, the only page reachable
        through this section is the AI-assisted screening workflow.
      </Callout>
      <p style={{ marginTop: 18 }}>
        <Link to="/wiki/skills/skill-ai-assisted-screening">
          &rarr; AI-assisted screening skill
        </Link>
      </p>
    </div>
  );
}