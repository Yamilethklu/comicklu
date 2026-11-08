import React from "react";
import { useState, type ReactNode, type ComponentProps } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("[ErrorBoundary] Error no capturado:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="frame p-6 text-center shadow-hard">
          <AlertCircle className="mx-auto h-10 w-10 text-pop mb-3" aria-hidden />
          <h2 className="font-display text-2xl tracking-wide mb-2">Algo salió mal</h2>
          <p className="mb-4 text-sm text-ink/70 max-w-xs mx-auto">
            {error?.message ?? "Se produjo un error inesperado."}
          </p>
          <button
            onClick={this.reset}
            className="btn-pop"
            aria-label="Reintentar"
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden /> Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Compatibilidad con hooks (wrapper funcional)
export function withErrorBoundary({ children, fallback }: Props) {
  const [state, setState] = useState<State>({ hasError: false, error: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capture = (error: any, info: any) => {
    console.error("[ErrorBoundary] Error capturado:", error, info);
    setState({ hasError: true, error });
  };

  if (state.hasError) {
    if (fallback) return fallback as ReactNode;
    return (
      <div className="frame p-6 text-center shadow-hard">
        <AlertCircle className="mx-auto h-10 w-10 text-pop mb-3" aria-hidden />
        <h2 className="font-display text-2xl tracking-wide mb-2">Algo salió mal</h2>
        <p className="mb-4 text-sm text-ink/70 max-w-xs mx-auto">
          {state.error?.message ?? "Se produjo un error inesperado."}
        </p>
        <button onClick={() => setState({ hasError: false, error: null })} className="btn-pop">
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden /> Reintentar
        </button>
      </div>
    );
  }
  return children as ReactNode;
}