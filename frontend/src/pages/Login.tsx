import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../components/Logo';
import { PLRABackground } from '../components/PLRABackground';
import './Login.css';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import axios from 'axios';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [onboardingUser, setOnboardingUser] = useState<any>(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings } = useSettings();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const loggedUser = await login({ username, password });
      
      if (loggedUser.needs_password_change) {
        setOnboardingUser(loggedUser);
        setShowOnboarding(true);
      } else {
        if (loggedUser.role === 'SUPERUSUARIO') navigate('/admin');
        else if (loggedUser.role === 'JEFE_CAMPANA' || loggedUser.role === 'CANDIDATO') navigate('/comando');
        else navigate('/coordinador'); // PADRINO and COORDINADOR go here
      }
    } catch (error: any) {
      const apiURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      if (error.message === 'Credenciales inválidas') {
        setError('Usuario o contraseña incorrectos.');
      } else {
        setError(`Error de acceso. Verifique su conexión.`);
        console.error("Login Error:", error);
      }
    } finally {
      setIsLoading(false);
    }
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
      const apiURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${apiURL}/api/users/update-password`, {
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
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '0 0 0.25rem', letterSpacing: '0.04em' }}>Acceso Restringido</h2>
            {error && <div style={{ color: 'var(--red)', marginTop: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}
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
              disabled={isLoading}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="spinner"></div>
                  Verificando...
                </span>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>
          
          <div className="footer-text">
            <p>
              Uso exclusivo del equipo de campaña del PLRA.
            </p>
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


