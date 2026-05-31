import { useEffect } from 'react';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function getRating(name: string, value: number): WebVitalMetric['rating'] {
  switch (name) {
    case 'LCP': return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'FID': case 'INP': return value <= 100 ? 'good' : value <= 200 ? 'needs-improvement' : 'poor';
    case 'CLS': return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'TTFB': return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    default: return 'needs-improvement';
  }
}

export function reportWebVital(metric: WebVitalMetric): void {
  if (import.meta.env.DEV) {
    console.log(`[WebVital] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
}

export function useWebVitals(): void {
  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    const observers: PerformanceObserver[] = [];

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          const entry = entries[entries.length - 1];
          reportWebVital({
            name: 'LCP',
            value: entry.startTime,
            rating: getRating('LCP', entry.startTime),
          });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcpObserver);
    } catch {}

    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        reportWebVital({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      observers.push(clsObserver);
    } catch {}

    try {
      const inpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          reportWebVital({
            name: 'INP',
            value: entry.duration,
            rating: getRating('INP', entry.duration),
          });
        }
      });
      inpObserver.observe({ type: 'first-input', buffered: true });
      observers.push(inpObserver);
    } catch {}

    try {
      const ttfbObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          reportWebVital({
            name: 'TTFB',
            value: entries[0].requestStart || entries[0].startTime,
            rating: getRating('TTFB', entries[0].requestStart || entries[0].startTime),
          });
        }
      });
      ttfbObserver.observe({ type: 'navigation', buffered: true });
      observers.push(ttfbObserver);
    } catch {}

    return () => observers.forEach(o => o.disconnect());
  }, []);
}
