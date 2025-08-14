import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center p-6">
          <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl max-w-2xl w-full">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-lg text-white">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span>Something went wrong</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-500/20 bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  The application encountered an unexpected error. This might be due to a network issue, 
                  invalid data, or a bug in the application.
                </AlertDescription>
              </Alert>

              {this.state.error && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-300">Error Details:</h3>
                  <div className="p-3 bg-gray-900/50 border border-gray-600 rounded-lg">
                    <p className="text-sm text-red-400 font-mono">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <Button
                  onClick={this.handleReset}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="border-gray-600 bg-gray-800/50 hover:bg-gray-700/50"
                >
                  Reload Application
                </Button>
              </div>

              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                    Show Stack Trace (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-900/50 border border-gray-600 rounded-lg">
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;