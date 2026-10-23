import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render errors so one broken component shows a recovery panel instead of a blank page.
// Conversations stay in localStorage, so reloading keeps the user's data.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error caught by ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-slate-500">Your chats are saved on this device. Reload the page to continue.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-md bg-slate-900 px-4 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Reload
        </button>
      </div>
    );
  }
}
