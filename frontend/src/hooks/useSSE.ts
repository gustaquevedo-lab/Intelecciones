import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

export const useSSE = (onEvent: (event: { type: string; data: any }) => void) => {
  const { user } = useAuth();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!user?.id) return;

    let eventSource: EventSource | null = null;
    let delay = 1000;
    let timeoutId: any = null;
    let everConnected = false;
    let errorCount = 0;

    const connect = () => {
      // API_BASE is e.g. 'http://localhost:5000/api'
      const url = `${API_BASE}/stream/events?userId=${user.id}`;

      eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'HEARTBEAT') return;
          onEventRef.current(payload);
        } catch (e) {
          console.error('[SSE] Failed to parse event data:', e);
        }
      };

      eventSource.onerror = () => {
        errorCount++;
        // Solo loggeamos el primer error (si nunca conectó) o cada 10 reconexiones
        // para no llenar la consola en redes intermitentes.
        if (!everConnected && errorCount === 1) {
          console.warn('[SSE] Conexion inicial falló, reintentando...');
        } else if (errorCount % 10 === 0) {
          console.warn(`[SSE] Reconectando (intento ${errorCount}, espera ${delay}ms)`);
        }
        if (eventSource) {
          eventSource.close();
        }
        timeoutId = setTimeout(() => {
          delay = Math.min(delay * 2, 30000);
          connect();
        }, delay);
      };

      eventSource.onopen = () => {
        if (!everConnected) everConnected = true;
        delay = 1000;
        errorCount = 0;
      };
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user?.id]);
};
