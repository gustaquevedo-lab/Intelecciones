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
    onRegistered(_r) {
    },
    onRegisterError(_error) {
    },
  });

  const [offlineReady, setOfflineReady] = offlineReadyState || [false, () => {}];
  const [needUpdate, setNeedUpdate] = needUpdateState || [false, () => {}];
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [countdown, setCountdown] = useState(15);
  const { isDark } = useTheme();
  const { settings } = useSettings();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Mandatory update: countdown auto-triggers if user doesn't act
  useEffect(() => {
    if (!needUpdate) {
      setCountdown(15);
      return;
    }
    if (countdown <= 0) {
      updateServiceWorker(true);
      setTimeout(() => window.location.reload(), 300);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [needUpdate, countdown]);

  const close = () => {
    setOfflineReady(false);
    // intentionally not clearing needUpdate — update is mandatory
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
      {/* UPDATE PROMPT — mandatory, non-dismissable */}
      {needUpdate && (
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
            border: `1px solid ${isDark ? 'var(--border)' : 'rgba(0, 71, 171, 0.2)'}`,
            borderRadius: '20px',
            padding: '1.25rem',
            boxShadow: isDark ? 'var(--shadow-lg)' : '0 10px 40px rgba(0, 71, 171, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{
              background: 'var(--plra-500)',
              padding: '10px',
              borderRadius: '12px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0, 71, 171, 0.25)'
            }}>
              <RefreshCw size={20} color="#FFFFFF" className="spin-slow" />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                Nueva versión disponible
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                Actualizando en <strong>{countdown}s</strong>. Hay mejoras listas para ti.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await updateServiceWorker(true);
                setTimeout(() => window.location.reload(), 300);
              } catch {
                window.location.reload();
              }
            }}
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
        </motion.div>
      )}

      {/* OFFLINE READY PROMPT — dismissable */}
      {offlineReady && !needUpdate && (
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
                background: 'var(--green)',
                padding: '10px',
                borderRadius: '12px',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)'
              }}>
                <RefreshCw size={20} color="#FFFFFF" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                  App lista para usar offline
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  Ya puedes usar el sistema sin internet.
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
            maxWidth: '360px',
            width: 'calc(100% - 40px)',
            background: isDark ? 'var(--surface-light)' : '#FFFFFF',
            border: `1px solid ${isDark ? 'var(--border)' : 'rgba(0, 71, 171, 0.2)'}`,
            borderRadius: '24px',
            padding: '1.5rem',
            boxShadow: isDark ? 'var(--shadow-lg)' : '0 15px 50px rgba(0, 71, 171, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              {settings.app_logo_url ? (
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  overflow: 'hidden', flexShrink: 0, border: `1px solid ${isDark ? 'var(--border)' : 'rgba(0, 71, 171, 0.1)'}`,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }}>
                  <img src={settings.app_logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" />
                </div>
              ) : (
                <div style={{
                  background: 'linear-gradient(135deg, var(--plra-400), var(--plra-600))',
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 8px 16px rgba(0, 71, 171, 0.25)'
                }}>
                  <MonitorSmartphone size={24} color="#FFFFFF" strokeWidth={2.5} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  Instalar Aplicación
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: isDark ? 'var(--text-3)' : '#475569', lineHeight: 1.5 }}>
                  Agrega un acceso directo para una experiencia táctica optimizada.
                </p>
              </div>
            </div>
            <button 
              onClick={closeInstall}
              style={{ 
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,71,171,0.06)', 
                border: 'none', 
                color: isDark ? 'var(--text-3)' : 'var(--plra-500)', 
                cursor: 'pointer', 
                borderRadius: '50%', 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <X size={18} />
            </button>
          </div>

          <button
            onClick={handleInstallClick}
            style={{
              width: '100%',
              padding: '0.9rem',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--plra-500), var(--plra-600))',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 8px 20px rgba(0, 71, 171, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 25px rgba(0, 71, 171, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 71, 171, 0.3)';
            }}
          >
            <Download size={20} color="#FFFFFF" strokeWidth={2.5} /> 
            <span>Instalar Intelecciones</span>
          </button>
        </motion.div>
      )}

    </AnimatePresence>
  );
};

export default UpdatePrompt;
