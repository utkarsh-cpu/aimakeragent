import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { ErrorReporter, ErrorCategory, ErrorSeverity } from '../utils/error-boundary';

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export interface ErrorBoundaryFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Report error
    ErrorReporter.reportError(
      error,
      ErrorCategory.RENDERING,
      ErrorSeverity.HIGH,
      {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name,
        props: this.props,
      }
    );

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Auto-reset after 10 seconds for non-critical errors
    if (!this.props.isolate) {
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetError();
      }, 10000);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, idx) => prevProps.resetKeys?.[idx] !== key)) {
        this.resetError();
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetError();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback: CustomFallback } = this.props;

    if (hasError && error && errorId) {
      if (CustomFallback) {
        return (
          <CustomFallback
            error={error}
            errorInfo={errorInfo}
            resetError={this.resetError}
            errorId={errorId}
          />
        );
      }

      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
          errorId={errorId}
        />
      );
    }

    return children;
  }
}

// Default error fallback component
export function DefaultErrorFallback({
  error,
  errorInfo,
  resetError,
  errorId,
}: ErrorBoundaryFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleReportBug = () => {
    const bugReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // In a real app, this would send to your error reporting service
    console.log('Bug report:', bugReport);
    
    // Copy to clipboard for easy reporting
    navigator.clipboard?.writeText(JSON.stringify(bugReport, null, 2));
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription>
            We encountered an unexpected error. This has been reported and we're working on a fix.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              Error ID: <code className="text-sm font-mono">{errorId}</code>
            </AlertDescription>
          </Alert>

          {isDevelopment && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                Technical Details
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <strong>Error:</strong>
                  <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                    {error.message}
                  </pre>
                </div>
                {error.stack && (
                  <div>
                    <strong>Stack Trace:</strong>
                    <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <strong>Component Stack:</strong>
                    <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={resetError} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={handleGoHome} className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
            <Button variant="outline" onClick={handleReportBug} size="sm">
              <Bug className="mr-2 h-4 w-4" />
              Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Specialized error boundaries for different sections
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError, errorId }) => (
        <div className="flex h-full items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
              <CardTitle>Chat Error</CardTitle>
              <CardDescription>
                There was a problem with the chat interface.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={resetError} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Restart Chat
              </Button>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Error ID: {errorId}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      onError={(error, errorInfo) => {
        ErrorReporter.reportError(
          error,
          ErrorCategory.RENDERING,
          ErrorSeverity.HIGH,
          { section: 'chat', componentStack: errorInfo.componentStack }
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export function SidebarErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError, errorId }) => (
        <div className="flex h-full items-center justify-center p-4">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-500 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Sidebar temporarily unavailable
            </p>
            <Button size="sm" onClick={resetError}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              ID: {errorId}
            </p>
          </div>
        </div>
      )}
      onError={(error, errorInfo) => {
        ErrorReporter.reportError(
          error,
          ErrorCategory.RENDERING,
          ErrorSeverity.MEDIUM,
          { section: 'sidebar', componentStack: errorInfo.componentStack }
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export function SettingsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError, errorId }) => (
        <div className="flex items-center justify-center p-8">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-red-500" />
              <CardTitle className="text-lg">Settings Error</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Unable to load settings panel
              </p>
              <Button onClick={resetError} size="sm">
                <RefreshCw className="mr-2 h-3 w-3" />
                Reload Settings
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Error ID: {errorId}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      onError={(error, errorInfo) => {
        ErrorReporter.reportError(
          error,
          ErrorCategory.RENDERING,
          ErrorSeverity.MEDIUM,
          { section: 'settings', componentStack: errorInfo.componentStack }
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Hook for using error boundaries programmatically
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}