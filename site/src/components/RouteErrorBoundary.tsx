import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface enough context in the console to diagnose without stopping the app.
    // eslint-disable-next-line no-console
    console.error('[RouteErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="route-view" style={{ padding: '24px 0' }}>
        <h1>Something went wrong on this page</h1>
        <p style={{ color: 'var(--ink-dim)', maxWidth: '78ch' }}>
          The error was captured so the rest of the site keeps working. Details are in the
          browser console. Use one of the links below to recover.
        </p>
        <pre style={{
          background: 'var(--panel-2)', border: '1px solid var(--line)',
          borderRadius: 8, padding: 12, marginTop: 12, whiteSpace: 'pre-wrap',
          fontSize: 12.5, color: 'var(--warn)',
        }}>{error.name}: {error.message}</pre>
        <p style={{ marginTop: 20 }}>
          <Link to="/" onClick={this.reset}>← Home</Link>
          {' · '}
          <Link to="/prisma" onClick={this.reset}>PRISMA overview</Link>
          {' · '}
          <button
            onClick={this.reset}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              color: 'var(--accent)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Retry this page
          </button>
        </p>
      </div>
    );
  }
}
