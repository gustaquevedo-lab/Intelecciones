import { useState, useEffect, useCallback } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  return useCallback(
    ((...args: Parameters<T>) => {
      const timeoutId = setTimeout(() => {
        callback(...args);
      }, delay);
      return () => clearTimeout(timeoutId);
    }) as T,
    [callback, delay]
  );
}

export function useDebouncedSearch(initialValue: string = '', delay: number = 300) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [debouncedTerm, setDebouncedTerm] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm, delay]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    debouncedTerm,
    clearSearch,
    isDebouncing: searchTerm !== debouncedTerm
  };
}

export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  limit: number
): T {
  let lastRan = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRan >= limit) {
      callback(...args);
      lastRan = now;
    }
  }) as T;
}

export function useRafCallback<T extends (...args: any[]) => void>(
  callback: T
): T {
  return useCallback(
    ((...args: Parameters<T>) => {
      requestAnimationFrame(() => callback(...args));
    }) as T,
    [callback]
  );
}