import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

export interface BroadcastState {
  logId: number;
  total: number;
  sent: number;
  failed: number;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

interface BroadcastContextValue {
  broadcast: BroadcastState | null;
  setBroadcast: (b: BroadcastState | null) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
}

const BroadcastContext = createContext<BroadcastContextValue>({
  broadcast: null,
  setBroadcast: () => {},
  pause: async () => {},
  resume: async () => {},
  cancel: async () => {},
  refresh: async () => {},
});

const LS_KEY = 'waBroadcastLogId';
const POLL_MS = 3000;

export const BroadcastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [broadcast, setBroadcastRaw] = useState<BroadcastState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const fetchLog = useCallback(async (id: number): Promise<BroadcastState | null> => {
    try {
      const r = await api.get(`/whatsapp/broadcast/logs/${id}`);
      const d = r.data;
      return { logId: d.id, total: d.target_count, sent: d.success_count, failed: d.fail_count, status: d.status };
    } catch { return null; }
  }, []);

  const setBroadcast = useCallback((b: BroadcastState | null) => {
    setBroadcastRaw(b);
    if (b) localStorage.setItem(LS_KEY, String(b.logId));
    else localStorage.removeItem(LS_KEY);
  }, []);

  const refresh = useCallback(async () => {
    if (!broadcast) return;
    const updated = await fetchLog(broadcast.logId);
    if (updated) setBroadcastRaw(updated);
  }, [broadcast, fetchLog]);

  // On mount: recover from localStorage or check active broadcast
  useEffect(() => {
    (async () => {
      const savedId = localStorage.getItem(LS_KEY);
      if (savedId) {
        const state = await fetchLog(parseInt(savedId));
        if (state && (state.status === 'RUNNING' || state.status === 'PAUSED')) {
          setBroadcastRaw(state);
          return;
        } else if (state && (state.status === 'COMPLETED' || state.status === 'CANCELLED')) {
          // Show final state briefly — don't lose it
          setBroadcastRaw(state);
          return;
        }
        localStorage.removeItem(LS_KEY);
      }
      // Fallback: check if there's an active broadcast from another session
      try {
        const r = await api.get('/whatsapp/broadcast/active');
        if (r.data) {
          const d = r.data;
          const state: BroadcastState = { logId: d.id, total: d.target_count, sent: d.success_count, failed: d.fail_count, status: d.status };
          setBroadcastRaw(state);
          localStorage.setItem(LS_KEY, String(d.id));
        }
      } catch { /* no auth yet, ignore */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling while RUNNING or PAUSED
  useEffect(() => {
    stopPolling();
    if (broadcast && (broadcast.status === 'RUNNING' || broadcast.status === 'PAUSED')) {
      pollRef.current = setInterval(async () => {
        const updated = await fetchLog(broadcast.logId);
        if (!updated) return;
        setBroadcastRaw(updated);
        if (updated.status !== 'RUNNING' && updated.status !== 'PAUSED') {
          stopPolling();
        }
      }, POLL_MS);
    }
    return stopPolling;
  }, [broadcast?.logId, broadcast?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(async () => {
    if (!broadcast) return;
    await api.post(`/whatsapp/broadcast/${broadcast.logId}/pause`);
    setBroadcastRaw(prev => prev ? { ...prev, status: 'PAUSED' } : null);
  }, [broadcast]);

  const resume = useCallback(async () => {
    if (!broadcast) return;
    await api.post(`/whatsapp/broadcast/${broadcast.logId}/resume`);
    setBroadcastRaw(prev => prev ? { ...prev, status: 'RUNNING' } : null);
  }, [broadcast]);

  const cancel = useCallback(async () => {
    if (!broadcast) return;
    await api.post(`/whatsapp/broadcast/${broadcast.logId}/cancel`);
    setBroadcastRaw(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
  }, [broadcast]);

  return (
    <BroadcastContext.Provider value={{ broadcast, setBroadcast, pause, resume, cancel, refresh }}>
      {children}
    </BroadcastContext.Provider>
  );
};

export const useBroadcast = () => useContext(BroadcastContext);
