import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/Logo';
import { PLRABackground } from '../components/PLRABackground';
import api, { API_BASE } from '../services/api';
import './Login.css';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

type ServerStatus = 'checking' | 'online' | 'waking' | 'offline';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [onboardingUser, setOnboardingUser] = useState<any>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [wakingSeconds, setWakingSeconds] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings } = useSettings();

  // ── Server health check ──────────────────────────────────────
  const checkServer = async (): Promise<boolean> => {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${API_BASE.replace('/api', '')}/api/health`, {
        signal: ctrl.signal,
        mode: 'cors',
        cache: 'no-store',
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  };

  const startWakingTimer = () => {
    setWakingSeconds(0);
    if (wakingTimerRef.current) clearInterval(wakingTimerRef.current);
    wakingTimerRef.current = setInterval(() => setWakingSeconds(s => s + 1), 1000);
  };

  const stopWakingTimer = () => {
    if (wakingTimerRef.current) { clearInterval(wakingTimerRef.current); wakingTimerRef.current = null; }
  };

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      const alive = await checkServer();
      if (cancelled) return;
      if (alive) {
        setServerStatus('online');
        stopWakingTimer();
        if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null; }
      } else {
        setServerStatus('waking');
        startWakingTimer();
        // Retry every 6 seconds until alive
        if (!retryTimerRef.current) {
          retryTimerRef.current = setInterval(async () => {
            if (cancelled) return;
            setRetryCount(c => c + 1);
            const alive2 = await checkServer();
            if (alive2 && !cancelled) {
              setServerStatus('online');
              stopWakingTimer();
              if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null; }
            }
          }, 6000);
        }
      }
    };

    probe();
    return () => {
      cancelled = true;
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
      stopWakingTimer();
    };
  }, []);

  // ── Login with auto-retry on network error ───────────────────
  const attemptLogin = async (lat: number | null, lng: number | null, attemptsLeft = 3): Promise<void> => {
    try {
      const loggedUser = await login({ username, password, lat, lng });
      if (loggedUser.needs_password_change) {
        setOnboardingUser(loggedUser);
        setShowOnboarding(true);
      } else {
        if (loggedUser.role === 'SUPERUSUARIO') navigate('/admin');
        else if (loggedUser.role === 'JEFE_CAMPANA' || loggedUser.role === 'CANDIDATO') navigate('/comando');
        else if (loggedUser.role === 'MIEMBRO_DE_MESA') navigate('/veedor');
        else navigate('/coordinador');
      }
    } catch (err: any) {
      const isNetwork = err.code === 'ERR_NETWORK' || err.message === 'Network Error' || err.code === 'ECONNABORTED';
      if (isNetwork && attemptsLeft > 1) {
        // Server might be waking up — wait 7s and retry
        setError(`Servidor iniciando... reintentando (${4 - attemptsLeft}/3)`);
        setServerStatus('waking');
        startWakingTimer();
        await new Promise(r => setTimeout(r, 7000));
        stopWakingTimer();
        const alive = await checkServer();
        if (alive) {
          setServerStatus('online');
          setError('');
          return attemptLogin(lat, lng, attemptsLeft - 1);
        } else {
          return attemptLogin(lat, lng, attemptsLeft - 1);
        }
      }
      if (err.response?.status === 401) {
        setError('Credenciales incorrectas. Verifique su usuario y contraseña.');
      } else if (isNetwork) {
        setError('No se puede conectar al servidor. Verifique su internet o intente en unos minutos.');
        setServerStatus('offline');
      } else {
        setError(err.response?.data?.error || err.message || 'Error desconocido');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    let lat = null, lng = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* location optional */ }

    await attemptLogin(lat, lng, 3);
    setIsLoading(false);
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/users/change-p', {
        user_id: onboardingUser.id,
        new_password: newPassword
      });
      
      // Re-login or just navigate
      if (onboardingUser.role === 'JEFE_CAMPANA' || onboardingUser.role === 'CANDIDATO') navigate('/comando');
      else navigate('/coordinador'); // Includes PADRINO
    } catch (err: any) {
      console.error('Password Update Error:', err.response?.data || err.message);
      setError(`Error al actualizar contraseña: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const serverLabel = {
    checking: { text: 'Verificando servidor...', color: '#93C5FD', dot: '#3B82F6', pulse: true },
    online:   { text: 'Servidor en línea',       color: '#86EFAC', dot: '#22C55E', pulse: false },
    waking:   { text: `Servidor iniciando... ${wakingSeconds}s`, color: '#FDE68A', dot: '#F59E0B', pulse: true },
    offline:  { text: 'Servidor sin respuesta',  color: '#FCA5A5', dot: '#EF4444', pulse: false },
  }[serverStatus];

  return (
    <div className="login-container">

      {/* Fondos Animados Compartidos */}
      <PLRABackground />

      {/* Título hero — wordmark grande encima del form */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="title-container"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}
      >
        <Logo variant="light" size="large" />
        <p className="sub-title" style={{ marginTop: '0.25rem' }}>
          Plataforma de Inteligencia Electoral y Análisis Geoespacial.
        </p>
      </motion.div>

      {/* Formulario de Acceso - Card Central */}
      <div className="form-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="login-card"
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '0 0 0.5rem', letterSpacing: '0.04em' }}>Acceso Restringido</h2>

            {/* Server status pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.3rem 0.75rem', borderRadius: '20px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '0.5rem'
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: serverLabel.dot,
                boxShadow: serverLabel.pulse ? `0 0 6px ${serverLabel.dot}` : 'none',
                animation: serverLabel.pulse ? 'pulse-dot 1.5s infinite' : 'none',
              }} />
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: serverLabel.color, letterSpacing: '0.04em' }}>
                {serverLabel.text}
              </span>
            </div>

            {/* Waking up explanation */}
            <AnimatePresence>
              {serverStatus === 'waking' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: '10px', padding: '0.6rem 0.9rem', marginBottom: '0.5rem',
                    textAlign: 'left', maxWidth: '100%'
                  }}
                >
                  <p style={{ fontSize: '0.7rem', color: '#FDE68A', fontWeight: 700, margin: '0 0 0.2rem' }}>⚡ Servidor en modo ahorro de energía</p>
                  <p style={{ fontSize: '0.62rem', color: 'rgba(253,230,138,0.7)', margin: 0, lineHeight: 1.4 }}>
                    El servidor se activa automáticamente. Espera 20-30 segundos
                    {retryCount > 0 ? ` (intento ${retryCount})` : ''} y el ingreso se habilitará solo.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div style={{ color: '#FCA5A5', marginTop: '0.5rem', fontSize: '0.82rem', fontWeight: 600, background: 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '0.5rem 0.75rem', width: '100%', textAlign: 'left' }}>
                {error}
              </div>
            )}
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="input-wrapper">
              <input
                type="text"
                className="modern-input"
                placeholder="Usuario o Cédula"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="input-wrapper">
              <input
                type="password"
                className="modern-input"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isLoading || serverStatus === 'checking'}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="spinner" />
                  {serverStatus === 'waking' ? 'Esperando servidor...' : 'Verificando...'}
                </span>
              ) : serverStatus === 'checking' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="spinner" />
                  Verificando conexión...
                </span>
              ) : serverStatus === 'waking' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="spinner" />
                  Servidor iniciando... ({wakingSeconds}s)
                </span>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>

          <div className="footer-text">
            <p>Uso exclusivo del equipo de campaña del PLRA.</p>
          </div>
        </motion.div>
      </div>

      {/* Modal de Onboarding / Cambio de Contraseña */}
      {showOnboarding && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ maxWidth: '400px', width: '90%', padding: '2rem' }}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>Bienvenido, {onboardingUser.nombre}</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Por seguridad, debes configurar una nueva contraseña para tu primera entrada.
            </p>
            
            <form onSubmit={handleCompleteOnboarding} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input 
                  type="password" 
                  className="modern-input-premium-styled"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="form-group">
                <label>Confirmar Contraseña</label>
                <input 
                  type="password" 
                  className="modern-input-premium-styled"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              
              {error && <p style={{ color: 'var(--red)', fontSize: '0.75rem', fontWeight: 600 }}>{error}</p>}
              
              <button 
                type="submit" 
                className="btn-confirm-styled"
                style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                disabled={isLoading}
              >
                {isLoading ? 'Actualizando...' : 'Comenzar Ahora'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Login;


