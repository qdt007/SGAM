import { Component, ErrorInfo, ReactNode } from 'react';
import { Icon } from '@iconify/react';

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Without this, any render-time throw unmounts the tree and leaves a blank page
 * with nothing to go on. Catch it and show what actually happened instead.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({ info: info.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <div className="card w-full max-w-xl">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
              <Icon icon="ph:warning-circle-duotone" width={22} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-subhead font-bold text-ink">This screen failed to load</h1>
              <p className="mt-1 text-small text-ink-muted">
                The rest of the app is still fine — you can go back or reload.
              </p>

              <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-sunken p-3 text-caption text-ink-muted">
                {error.message}
                {info ? `\n${info.split('\n').slice(0, 6).join('\n')}` : ''}
              </pre>

              <div className="mt-5 flex gap-3">
                <button onClick={() => window.location.reload()} className="btn-primary btn-sm">
                  <Icon icon="ph:arrow-clockwise" width={15} aria-hidden />
                  Reload
                </button>
                <button onClick={() => this.setState({ error: null, info: null })} className="btn-secondary btn-sm">
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
