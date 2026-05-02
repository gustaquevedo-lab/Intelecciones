import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../components/Logo';
import { PLRABackground } from '../components/PLRABackground';
import './Login.css';

import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const loggedUser = await login({ username, password });
      
      if (loggedUser.role === 'SUPERUSUARIO') navigate('/admin');
      else if (loggedUser.role === 'JEFE_CAMPANA') navigate('/comando');
      else navigate('/coordinador');
    } catch (error: any) {
      const apiURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      setError(`Error de acceso. Verificando conexión con: ${apiURL}`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      
      {/* Fondos Animados Compartidos */}
      <PLRABackground />
      
      {/* Título y Subtítulo - Flotando arriba del form */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="title-container"
      >
        <h1 className="main-title">
          Intelecciones
        </h1>
        <p className="sub-title">
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
            <div style={{ marginBottom: '1rem' }}><Logo variant="light" /></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 500, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Acceso Restringido</h2>
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
    </div>
  );
};

export default Login;


