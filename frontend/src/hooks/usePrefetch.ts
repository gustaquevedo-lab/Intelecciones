import { useCallback, useRef } from 'react';

export const usePrefetch = () => {
  const prefetchedRef = useRef<Set<string>>(new Set());
  
  const prefetch = useCallback((path: string) => {
    if (prefetchedRef.current.has(path)) return;
    prefetchedRef.current.add(path);
    
    // Prefetch the JS chunk for the route
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = `/_assets/${path}.js`;
    document.head.appendChild(link);
  }, []);
  
  const reset = useCallback(() => {
    prefetchedRef.current.clear();
  }, []);
  
  return { prefetch, reset };
};

export const usePrefetchOnHover = () => {
  const prefetchRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const prefetchRoute = useCallback((path: string) => {
    // Clear any existing timeout for this path
    const existing = prefetchRef.current.get(path);
    if (existing) clearTimeout(existing);
    
    // Delay prefetch slightly to avoid triggering on quick mouse-through
    const timeout = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'script';
        link.href = path;
        document.head.appendChild(link);
        
        // Also try to preload the chunk
        const chunks = document.querySelectorAll('script[src*="chunk"]');
        // Skip - the browser handles this automatically with prefetch
      }
    }, 150);
    
    prefetchRef.current.set(path, timeout);
  }, []);
  
  const cancelPrefetch = useCallback((path: string) => {
    const timeout = prefetchRef.current.get(path);
    if (timeout) {
      clearTimeout(timeout);
      prefetchRef.current.delete(path);
    }
  }, []);
  
  return { prefetchRoute, cancelPrefetch };
};

export default usePrefetch;