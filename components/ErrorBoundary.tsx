import React from 'react';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">문제가 발생했습니다</h3>
          <p className="text-sm text-slate-500 mb-4">
            {this.props.fallbackLabel || '페이지를 불러오는 중 오류가 발생했습니다.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { this.props.onReset?.(); this.setState({ hasError: false, error: null }); }}
              className="px-4 py-2 bg-toss-blue text-white rounded-xl text-sm font-semibold"
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-toss-surf text-toss-ink rounded-xl text-sm font-semibold"
            >
              앱 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
