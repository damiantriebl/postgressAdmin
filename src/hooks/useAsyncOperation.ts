import { useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';

interface UseAsyncOperationOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

interface UseAsyncOperationReturn<T> {
  isLoading: boolean;
  error: string | null;
  data: T | null;
  execute: (operation: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export function useAsyncOperation<T = any>(
  options: UseAsyncOperationOptions = {}
): UseAsyncOperationReturn<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const { addToast } = useToast();

  const {
    successMessage,
    errorMessage,
    showSuccessToast = false,
    showErrorToast = true,
  } = options;

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      setData(result);

      if (showSuccessToast && successMessage) {
        addToast({
          type: 'success',
          message: successMessage,
        });
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);

      if (showErrorToast) {
        addToast({
          type: 'error',
          title: 'Operation Failed',
          message: errorMessage || errorMsg,
        });
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [addToast, successMessage, errorMessage, showSuccessToast, showErrorToast]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    isLoading,
    error,
    data,
    execute,
    reset,
  };
}