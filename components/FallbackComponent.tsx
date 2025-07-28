import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface FallbackComponentProps {
  componentName: string;
  error?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}

/**
 * Fallback component for missing or failed components
 */
export function FallbackComponent({ 
  componentName, 
  error, 
  onRetry, 
  children 
}: FallbackComponentProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </div>
        <CardTitle className="text-lg">Component Unavailable</CardTitle>
        <CardDescription>
          The {componentName} component is temporarily unavailable.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {error && (
          <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
            {error}
          </div>
        )}
        
        {children && (
          <div className="text-sm text-muted-foreground">
            {children}
          </div>
        )}
        
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            Try Again
          </Button>
        )}
        
        <p className="text-xs text-muted-foreground">
          This is a temporary fallback. The component should load normally after a refresh.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Higher-order component that provides fallback for missing components
 */
export function withFallback<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function FallbackWrapper(props: P) {
    try {
      return <Component {...props} />;
    } catch (error) {
      console.error(`Component ${componentName} failed to render:`, error);
      return (
        <FallbackComponent
          componentName={componentName}
          error={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => window.location.reload()}
        />
      );
    }
  };
}

/**
 * Graceful fallback for lazy-loaded components
 */
export function LazyFallback({ componentName }: { componentName: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">Loading {componentName}...</p>
      </div>
    </div>
  );
}

/**
 * Error fallback for Suspense boundaries
 */
export function SuspenseFallback({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-pulse flex space-x-1 mb-2">
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}