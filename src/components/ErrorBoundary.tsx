import React, { Component, ErrorInfo, ReactNode } from 'react';
import { GoAlert, GoSync, GoCopy, GoCheck } from 'react-icons/go';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MicroRustSim ErrorBoundary Caught Crash]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleCopyDetails = () => {
    const details = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown error'}\n\nStack:\n${this.state.error?.stack || 'No stack'}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || 'No component stack'}`;
    navigator.clipboard?.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-[#09090b] text-zinc-200 p-6 select-none font-sans">
          <div className="w-full max-w-lg bg-[#121215] border border-[#27272a] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-[#222226] pb-4">
              <div className="w-9 h-9 rounded-lg bg-red-950/60 border border-red-900/60 flex items-center justify-center text-red-400 shrink-0">
                <GoAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-100">
                  {this.props.fallbackTitle || 'Interface Render Error Intercepted'}
                </h2>
                <p className="text-xs text-zinc-400 truncate">
                  A component error occurred, but the simulator recovered from blanking out.
                </p>
              </div>
            </div>

            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3 text-left">
              <p className="text-[11px] font-mono text-red-300 break-words font-medium">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown component error'}
              </p>
              {this.state.error?.stack && (
                <div className="mt-2 max-h-36 overflow-y-auto text-[10px] font-mono text-zinc-500 whitespace-pre-wrap leading-relaxed border-t border-[#222226] pt-2">
                  {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181b] hover:bg-[#222226] border border-[#27272a] text-xs text-zinc-300 transition-colors cursor-pointer"
              >
                {this.state.copied ? <GoCheck className="w-3.5 h-3.5 text-emerald-400" /> : <GoCopy className="w-3.5 h-3.5" />}
                <span>{this.state.copied ? 'Copied Details' : 'Copy Log'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-zinc-200 hover:bg-white text-zinc-900 text-xs font-medium transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <GoSync className="w-3.5 h-3.5" />
                <span>Recover UI</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
