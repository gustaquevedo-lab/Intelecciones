import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const UpdatePrompt = () => {
  const {
    offlineReady: offlineReadyState,
    needUpdate: needUpdateState,
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [offlineReady, setOfflineReady] = offlineReadyState || [false, () => {}];
  const [needUpdate, setNeedUpdate] = needUpdateState || [false, () => {}];

  const close = () => {
    setOfflineReady(false);
    setNeedUpdate(false);
  };

  return (
    <AnimatePresence>
      {(offlineReady || needUpdate) && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            maxWidth: '320px',
            background: 'var(--surface-light)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{
                background: needUpdate ? 'var(--plra-500)' : 'var(--green)',
                padding: '8px',
                borderRadius: '10px',
                color: 'white'
              }}>
                <RefreshCw size={20} className={needUpdate ? 'spin-slow' : ''} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                  {needUpdate ? 'Nueva versión disponible' : 'App lista para usar offline'}
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  {needUpdate 
                    ? 'Hay mejoras listas. Actualiza para ver los últimos cambios.' 
                    : 'Ya puedes usar el sistema sin internet.'}
                </p>
              </div>
            </div>
            <button 
              onClick={close}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {needUpdate && (
            <button
              onClick={() => updateServiceWorker(true)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--plra-500)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              Actualizar Ahora
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdatePrompt;
