import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center p-6 text-center">
          <div className="bg-[#0f0f11] border border-red-500/30 p-8 rounded-3xl shadow-2xl max-w-lg shadow-red-500/10">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong.</h1>
            <p className="text-red-400 mb-6 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-500/20 text-red-500 hover:bg-red-500/30 px-6 py-2 rounded-xl transition-colors font-bold uppercase tracking-wider text-xs"
            >
              Restart Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
