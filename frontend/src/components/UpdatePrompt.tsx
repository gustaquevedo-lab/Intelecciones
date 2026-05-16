import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Download, MonitorSmartphone } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
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
  const { isDark } = useTheme();
  const { settings } = useSettings();

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
            maxWidth: '340px',
            width: 'calc(100% - 40px)',
            background: isDark ? 'var(--surface-light)' : '#FFFFFF',
            border: `1px solid ${isDark ? 'var(--border)' : 'rgba(0, 71, 171, 0.15)'}`,
            borderRadius: '20px',
            padding: '1.25rem',
            boxShadow: isDark ? 'var(--shadow-lg)' : '0 10px 40px rgba(0, 71, 171, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{
                background: needUpdate ? 'var(--plra-500)' : 'var(--green)',
                padding: '10px',
                borderRadius: '12px',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${needUpdate ? 'rgba(0, 71, 171, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
              }}>
                <RefreshCw size={20} color="#FFFFFF" className={needUpdate ? 'spin-slow' : ''} />
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
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-3)', cursor: 'pointer', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {needUpdate && (
            <button
              onClick={() => updateServiceWorker(true)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--plra-500)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 15px rgba(0, 71, 171, 0.3)'
              }}
            >
              <RefreshCw size={16} color="#FFFFFF" /> Actualizar Ahora
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
            bottom: offlineReady ? '150px' : '20px',
            right: '20px',
            zIndex: 9998,
            maxWidth: '340px',
            width: 'calc(100% - 40px)',
            background: isDark ? 'var(--surface-light)' : '#FFFFFF',
            border: `1px solid ${isDark ? 'var(--border)' : 'rgba(0, 71, 171, 0.15)'}`,
            borderRadius: '20px',
            padding: '1.25rem',
            boxShadow: isDark ? 'var(--shadow-lg)' : '0 10px 40px rgba(0, 71, 171, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {settings.app_logo_url ? (
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)'
                }}>
                  <img src={settings.app_logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" />
                </div>
              ) : (
                <div style={{
                  background: 'var(--primary)',
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0, 71, 171, 0.2)'
                }}>
                  <MonitorSmartphone size={22} color="#FFFFFF" />
                </div>
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>
                  Instalar Aplicación
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.4 }}>
                  Acceso directo en tu pantalla de inicio para una mejor experiencia táctica.
                </p>
              </div>
            </div>
            <button 
              onClick={closeInstall}
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-3)', cursor: 'pointer', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={handleInstallClick}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(0, 71, 171, 0.3)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Download size={18} color="#FFFFFF" /> Instalar Intelecciones
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdatePrompt;
