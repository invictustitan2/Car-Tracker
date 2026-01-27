import { AlertTriangle } from 'lucide-react';
import { Component } from 'react';

/**
 * Error boundary that catches React rendering errors and provides
 * a fallback UI with options to recover (reload or clear data).
 */
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearData = () => {
    if (window.confirm('This will clear all local data and reload the app. Continue?')) {
      try {
        window.localStorage.clear();
        window.location.reload();
      } catch (err) {
        console.error('Failed to clear localStorage:', err);
        // Fallback: just reload
        window.location.reload();
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Something went wrong
              </h1>
            </div>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The app encountered an unexpected error. This might be due to corrupted local data or a temporary issue.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
                <summary className="cursor-pointer text-slate-700 dark:text-slate-300 font-semibold mb-2">
                  Error Details (Dev Only)
                </summary>
                <div className="text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </div>
              </details>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Reload App
              </button>
              <button
                onClick={this.handleClearData}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Clear Local Data & Reload
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 text-center">
              If the problem persists, contact your system administrator.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
