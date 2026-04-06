import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallbackTitle?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("[ErrorBoundary] Uncaught error:", error);
        console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-20 px-6 gap-5 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-[#3D3D3D] font-bold text-lg mb-1">
                            {this.props.fallbackTitle || "Something went wrong"}
                        </h3>
                        <p className="text-[#8B8178] text-sm max-w-md">
                            An unexpected error occurred. Try refreshing this section.
                        </p>
                        {this.state.error && (
                            <p className="mono-tag text-[9px] text-[#8B8178]/40 mt-3 max-w-md break-all">
                                {this.state.error.message}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={this.handleRetry}
                        className="mt-2 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
