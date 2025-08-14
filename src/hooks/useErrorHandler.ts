import { useCallback } from 'react';
import { useToast } from '@/components/Toast';

interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  title?: string;
}

export function useErrorHandler() {
  const { addToast } = useToast();

  const handleError = useCallback((
    error: unknown,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logToConsole = true,
      title = 'Error',
    } = options;

    let errorMessage = 'An unexpected error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    if (logToConsole) {
      console.error('Error handled:', error);
    }

    if (showToast) {
      addToast({
        type: 'error',
        title,
        message: errorMessage,
        duration: 7000, // Longer duration for errors
      });
    }

    return errorMessage;
  }, [addToast]);

  const handleAsyncError = useCallback(async <T>(
    asyncOperation: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<T | null> => {
    try {
      return await asyncOperation();
    } catch (error) {
      handleError(error, options);
      return null;
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
  };
}