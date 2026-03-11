import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl max-w-2xl mx-auto shadow-sm">
          <h2 className="text-red-800 text-xl font-semibold mb-3">Oops, something went wrong</h2>
          <div className="bg-white p-4 rounded-lg border border-red-100 overflow-auto">
            <pre className="text-red-600 text-sm whitespace-pre-wrap font-mono">
              {this.state.error?.message || 'Unknown error occurred'}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
