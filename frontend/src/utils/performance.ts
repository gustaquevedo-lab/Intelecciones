const isDev = import.meta.env.DEV;

export const debug = {
  log: (...args: any[]) => {
    if (isDev) console.log('[DEV]', ...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('[DEV]', ...args);
  },
  error: (...args: any[]) => {
    if (isDev) console.error('[DEV]', ...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info('[DEV]', ...args);
  }
};

export const perf = {
  mark: (name: string) => {
    if (isDev && performance.mark) performance.mark(name);
  },
  measure: (name: string, startMark: string, endMark?: string) => {
    if (isDev && performance.measure) {
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }
    }
  },
  getEntriesByName: (name: string) => {
    if (isDev && performance.getEntriesByName) {
      return performance.getEntriesByName(name);
    }
    return [];
  }
};

export const createListMemo = <T extends { id?: number | string }>(
  Component: React.ComponentType<any>
) => {
  return React.memo(Component, (prevProps, nextProps) => {
    const prevId = prevProps.item?.id ?? prevProps.item?.ci;
    const nextId = nextProps.item?.id ?? nextProps.item?.ci;
    
    if (prevId !== nextId) return false;
    
    const prevKeys = Object.keys(prevProps).sort();
    const nextKeys = Object.keys(nextProps).sort();
    
    if (prevKeys.length !== nextKeys.length) return false;
    
    for (const key of prevKeys) {
      if (prevProps[key] !== nextProps[key]) return false;
    }
    
    return true;
  });
};

export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

export const createImmutableGetter = <T extends object, K extends keyof T>(
  obj: T,
  key: K
): T[K] => obj[key];