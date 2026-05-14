import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const UpdatePrompt = () => {
  const {
    offlineReady: offlineReadyState,
    needRefresh: needUpdateState,
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const close = () => {
    setOfflineReady(false);
    setNeedUpdate(false);
  };

  const closeInstall = () => {
    setDeferredPrompt(null);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <AnimatePresence>
      {/* UPDATE / OFFLINE PROMPT */}
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

      {/* INSTALL PROMPT */}
      {deferredPrompt && !needUpdate && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: offlineReady ? '130px' : '20px',
            right: '20px',
            zIndex: 9998,
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
                background: 'var(--blue-lt)',
                padding: '8px',
                borderRadius: '10px',
                color: 'white'
              }}>
                <Download size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                  Instalar Intelecciones
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  Instala la aplicación en tu pantalla de inicio para un acceso más rápido.
                </p>
              </div>
            </div>
            <button 
              onClick={closeInstall}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={handleInstallClick}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--blue-lt)',
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
            Instalar App
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdatePrompt;
