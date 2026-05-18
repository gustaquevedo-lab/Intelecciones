import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { LogOut, Shield, Moon, Sun, Monitor, Menu, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { ModuleSwitcher } from './ModuleSwitcher';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import api, { getImageUrl } from '../services/api';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  userName: string;
  userPhoto?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, title, userName, userPhoto }) => {
  const navigate = useNavigate();
  const { user, activeListId, setActiveListId, activeDistrict, setActiveDistrict } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings } = useSettings();
  const [lists, setLists] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA' || user?.role === 'PADRINO' || user?.role === 'SUBJEFE') {
      api.get('/lists').then(res => setLists(res.data)).catch(err => console.error(err));
    }
  }, [user]);

  const initials = userName.slice(0, 2).toUpperCase();

  const roleLabels: Record<string, string> = {
    'SUPERUSUARIO':    'Super Admin',
    'JEFE_CAMPANA':    'Jefe de Campaña',
    'PADRINO':         'Padrino',
    'SUBJEFE':         'Sub Jefe',
    'COORDINADOR':     'Coordinador',
    'MIEMBRO_DE_MESA': 'Miembro de Mesa'
  };
  const currentRoleLabel = user ? (roleLabels[user.role] ?? 'Usuario') : 'Usuario';

  const showDistrictSelector = user?.role === 'SUPERUSUARIO' || (user?.role === 'JEFE_CAMPANA' && !user?.distrito);
  const showListSelector = user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA' || user?.role === 'SUBJEFE';
  const [districts, setDistricts] = useState<string[]>([]);
  
  useEffect(() => {
    api.get('/districts/global').then(res => setDistricts(res.data)).catch(err => console.error(err));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="main-header">

        {/* ── ROW 1 ── Logo · Filters · User controls */}
        <div className="header-row1">

          {/* LEFT: hamburger + logo */}
          <div className="header-left">
            <button
              className="header-hamburger"
              onClick={() => document.dispatchEvent(new CustomEvent('toggle-sidebar'))}
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <div className="header-logo-wrap">
              <Logo />
            </div>
          </div>

          {/* CENTER: district + list selector — only md+ */}
          {(showDistrictSelector || showListSelector) && (
            <div className="header-center">
              <div className="header-filters-pill">
                {showDistrictSelector && (
                  <>
                    <div className="header-filter-group">
                      <span className="header-filter-label">DISTRITO</span>
                      <select
                        value={activeDistrict ?? 'null'}
                        onChange={e => {
                          setActiveDistrict(e.target.value === 'null' ? null : e.target.value);
                          setActiveListId(null);
                        }}
                        disabled={user?.role !== 'SUPERUSUARIO' && user?.role !== 'JEFE_CAMPANA'}
                        className="header-filter-select"
                      >
                        <option value="null">🌎 TODOS</option>
                        {districts.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {showListSelector && <div className="header-filter-divider" />}
                  </>
                )}

                {showListSelector && (
                  <div className="header-filter-group">
                    <span className="header-filter-label">LISTA</span>
                    <select
                      value={activeListId === null ? 'null' : activeListId}
                      onChange={e => setActiveListId(e.target.value === 'null' ? null : parseInt(e.target.value))}
                      className="header-filter-select"
                    >
                      <option value="null">📋 TODAS</option>
                      {lists
                        .filter(l => {
                          const effectiveDistrict = activeDistrict || user?.distrito;
                          return !effectiveDistrict || (l.ciudad?.toUpperCase().trim() === effectiveDistrict) || (l.campaign_distrito?.toUpperCase().trim() === effectiveDistrict);
                        })
                        .map((l: any) => (
                          <option key={l.id} value={l.id}>
                            L-{l.list_number} — {l.candidate_alias || l.candidate_nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RIGHT: theme · countdown · user · logout */}
          <div className="header-right">
            {/* Theme toggle */}
            <div className="header-theme-toggle">
              {([
                { id: 'light',  icon: Sun },
                { id: 'system', icon: Monitor },
                { id: 'dark',   icon: Moon },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`header-theme-btn${theme === t.id ? ' active' : ''}`}
                  title={t.id.toUpperCase()}
                >
                  <t.icon size={13} />
                </button>
              ))}
            </div>

            <HeaderCountdown targetDate={settings.election_date} />
            <HeaderConnectionStatus />

            {/* User info — hidden on small mobile */}
            <div className="header-user-info">
              <span className="header-user-name">{userName}</span>
              <span className="header-user-role">
                <span 
                  className="header-online-dot" 
                  style={{ 
                    background: isOnline ? '#22C55E' : '#F59E0B',
                    boxShadow: isOnline ? '0 0 6px #22C55E' : '0 0 6px #F59E0B',
                    width: '6px',
                    height: '6px',
                    transition: 'all 0.3s ease'
                  }} 
                />
                {currentRoleLabel}
              </span>
            </div>

            {/* Avatar */}
            <div className="header-avatar">
              {userPhoto
                ? <img src={getImageUrl(userPhoto) || ''} alt={userName} />
                : <span>{initials}</span>}
            </div>

            {/* Logout */}
            <button onClick={() => navigate('/logout')} className="header-logout" aria-label="Cerrar sesión">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* ── ROW 2 ── Module switcher + current module title */}
        <div className="header-row2">
          <ModuleSwitcher />
          <div className="header-row2-separator" />
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="header-module-pill"
          >
            <Shield size={11} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
            <span className="header-module-title-text">{title}</span>
          </motion.div>
        </div>

        {/* ── ROW 3 ── Mobile-only compact filter bar */}
        {(showDistrictSelector || showListSelector) && (
          <div className="header-row3">
            {showDistrictSelector && (
              <>
                <div className="header-row3-group">
                  <span className="header-row3-label">DIST</span>
                  <select
                    value={activeDistrict ?? 'null'}
                    onChange={e => {
                      setActiveDistrict(e.target.value === 'null' ? null : e.target.value);
                      setActiveListId(null);
                    }}
                    className="header-row3-select"
                  >
                    <option value="null">🌎 Todos</option>
                    {districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                {showListSelector && <div className="header-row3-divider" />}
              </>
            )}
            {showListSelector && (
              <div className="header-row3-group">
                <span className="header-row3-label">LISTA</span>
                <select
                  value={activeListId === null ? 'null' : activeListId}
                  onChange={e => setActiveListId(e.target.value === 'null' ? null : parseInt(e.target.value))}
                  className="header-row3-select"
                >
                  <option value="null">📋 Todas</option>
                  {lists
                    .filter(l => {
                      const effectiveDistrict = activeDistrict || user?.distrito;
                      return !effectiveDistrict || (l.ciudad?.toUpperCase().trim() === effectiveDistrict) || (l.campaign_distrito?.toUpperCase().trim() === effectiveDistrict);
                    })
                    .map((l: any) => (
                      <option key={l.id} value={l.id}>
                        L-{l.list_number} — {l.candidate_alias || l.candidate_nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        )}
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
};

/* ── Countdown widget ──────────────────────────────────────── */
const HeaderCountdown = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date(targetDate);
      if (now.toDateString() !== target.toDateString()) { setTimeLeft(null); return; }
      const closing = new Date(target);
      closing.setHours(17, 0, 0, 0);
      const diff = closing.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('CERRADO');
      } else {
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${h}:${m}:${s}`);
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  if (!timeLeft) return null;
  const closed = timeLeft === 'CERRADO';
  return (
    <div className={`header-countdown${closed ? ' closed' : ''}`}>
      <Clock size={12} className={!closed ? 'animate-pulse' : ''} />
      <span>{timeLeft}</span>
    </div>
  );
};

/* ── Glowing Real-time Connection & Sync Status Badge ──────────────── */
const HeaderConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkPending = async () => {
    try {
      const { getPendingActions } = await import('../services/offlineDb');
      const actions = await getPendingActions();
      setPendingCount(actions.length);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync on reconnect
      setIsSyncing(true);
      import('../services/syncService').then(({ syncPendingActions }) => {
        syncPendingActions().finally(() => {
          setIsSyncing(false);
          checkPending();
        });
      });
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkPending();
    const interval = setInterval(checkPending, 4000); // Check every 4 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const { syncPendingActions } = await import('../services/syncService');
      const res = await syncPendingActions();
      
      if (res.totalProcessed === 0) {
        window.alert("ℹ️ Todo al día: No hay registros pendientes por subir en este dispositivo.");
      } else if (res.successCount > 0 && res.failedCount === 0) {
        window.alert(`✅ ¡Sincronización Exitosa!\n\nSe subieron ${res.successCount} registros pendientes al servidor de forma segura.`);
      } else if (res.successCount > 0 && res.failedCount > 0) {
        window.alert(`⚠️ Sincronización Parcial:\n\nSe subieron ${res.successCount} registros con éxito.\nQuedan ${res.failedCount} registros resguardados localmente por mala señal o congestión.`);
      } else {
        window.alert(`❌ Conexión Fallida:\n\nNo se pudo establecer conexión estable con el servidor. Tus ${res.failedCount} registros pendientes siguen totalmente a salvo en la memoria local del teléfono.`);
      }
    } catch (err) {
      console.error(err);
      window.alert("❌ Ocurrió un error inesperado al sincronizar los registros de campo.");
    } finally {
      setIsSyncing(false);
      checkPending();
    }
  };

  const isPending = pendingCount > 0;

  if (!isOnline) {
    return (
      <div 
        className="connection-status-badge offline"
        onClick={handleManualSync}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.6rem',
          borderRadius: '9px',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.3)',
          color: '#F59E0B',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '0.68rem',
          letterSpacing: '0.04em',
          flexShrink: 0,
          boxShadow: '0 0 10px rgba(245,158,11,0.1)',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          userSelect: 'none'
        }}
        title={`Sin conexión. ${pendingCount} registros guardados localmente. Haz clic para intentar sincronizar manualmente.`}
      >
        <WifiOff size={11} className={isSyncing ? '' : 'animate-pulse'} />
        <span className="connection-status-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
          OFFLINE {isPending && <span style={{ fontSize: '0.6rem', background: '#F59E0B', color: '#000000', padding: '1px 4px', borderRadius: '4px', fontWeight: 900 }}>{pendingCount}</span>}
        </span>
      </div>
    );
  }

  if (isPending || isSyncing) {
    return (
      <div 
        className="connection-status-badge syncing"
        onClick={handleManualSync}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.6rem',
          borderRadius: '9px',
          background: 'rgba(59,130,246,0.12)',
          border: '1px solid rgba(59,130,246,0.3)',
          color: '#3B82F6',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '0.68rem',
          letterSpacing: '0.04em',
          flexShrink: 0,
          boxShadow: '0 0 12px rgba(59,130,246,0.2)',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          userSelect: 'none'
        }}
        title={`Sincronizando ${pendingCount} acciones pendientes con el servidor... Haz clic para forzar.`}
      >
        <RefreshCw size={11} style={{ animation: 'spin 1.5s linear infinite' }} />
        <span className="connection-status-text">{isSyncing ? 'ENVIANDO...' : `ENVIANDO (${pendingCount})`}</span>
      </div>
    );
  }

  return (
    <div 
      className="connection-status-badge online"
      onClick={handleManualSync}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem 0.6rem',
        borderRadius: '9px',
        background: 'rgba(34,197,94,0.12)',
        border: '1px solid rgba(34,197,94,0.3)',
        color: '#22C55E',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '0.68rem',
        letterSpacing: '0.04em',
        flexShrink: 0,
        boxShadow: '0 0 10px rgba(34,197,94,0.1)',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      title="Conectado en tiempo real con el servidor. Haz clic para forzar sincronización manual."
    >
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E' }} />
      <span className="connection-status-text">EN LÍNEA</span>
    </div>
  );
};

export default MainLayout;
