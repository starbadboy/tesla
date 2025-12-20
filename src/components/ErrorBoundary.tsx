import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        } else {
            console.error('Uncaught error:', error, errorInfo);
        }
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="p-4 text-red-500 bg-red-50 rounded border border-red-200">
                    <h3 className="font-bold">Something went wrong.</h3>
                    <p className="text-sm mt-2">{this.state.error?.message}</p>
                </div>
            );
        }

        return this.props.children;
    }
}
