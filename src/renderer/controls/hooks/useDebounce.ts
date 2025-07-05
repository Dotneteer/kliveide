import { useCallback, useRef, useState, useEffect } from "react";

/**
 * Wraps an async function with error handling
 * @param fn The async function to wrap
 * @param errorHandler Optional custom error handler
 * @returns A wrapped function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T, 
  errorHandler?: (error: Error) => void
) {
  return async (...args: Parameters<T>): Promise<ReturnType<T> | void> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`Error in ${fn.name || 'async function'}:`, error);
      errorHandler?.(error as Error);
    }
  };
}

/**
 * A custom hook that creates a debounced version of a value.
 * @param value The value to be debounced
 * @param delay The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Update the debounced value after the specified delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer when value changes or component unmounts
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * A custom hook that returns a debounced version of a function.
 * The debounced function will only execute after the specified delay
 * since the last time it was called.
 * 
 * @param callback The function to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced function
 */
export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => ReturnType<T> {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      return new Promise<ReturnType<T>>((resolve) => {
        timeoutRef.current = setTimeout(() => {
          resolve(callback(...args) as ReturnType<T>);
        }, delay);
      });
    },
    [callback, delay]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback as (...args: Parameters<T>) => ReturnType<T>;
}

/**
 * A more advanced debounce hook that allows for immediate execution 
 * on the first call or after the debounce period.
 * 
 * @param fn The function to debounce
 * @param delay Delay in milliseconds
 * @returns A debounced version of the function
 */
export function useAdvancedDebounce<T extends (...args: any[]) => Promise<void> | void>(
  fn: T, 
  delay: number
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTime = useRef<number>(0);
  const isFirstCall = useRef<boolean>(true);
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // If this is the first call or enough time has passed since the last call, execute immediately
    if (isFirstCall.current || now - lastCallTime.current > delay) {
      isFirstCall.current = false;
      lastCallTime.current = now;
      return fn(...args);
    }
    
    // Otherwise, debounce the call
    return new Promise<void>((resolve) => {
      timeoutRef.current = setTimeout(() => {
        lastCallTime.current = Date.now();
        resolve(fn(...args));
      }, delay);
    });
  }, [fn, delay]);
}
