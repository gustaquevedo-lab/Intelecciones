import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
const Login = React.lazy(() => import('./pages/Login'));
const CoordinatorApp = React.lazy(() => import('./pages/CoordinatorApp'));
const CommandCenter = React.lazy(() => import('./pages/CommandCenter'));
const VeedorApp = React.lazy(() => import('./pages/VeedorApp'));
const SuperAdmin = React.lazy(() => import('./pages/SuperAdmin'));
const LogisticsApp = React.lazy(() => import('./pages/LogisticsApp'));
const Communications = React.lazy(() => import('./pages/Communications'));
const DiaDApp = React.lazy(() => import('./pages/DiaDApp'));
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import UpdatePrompt from './components/UpdatePrompt';
import './services/syncService'; // Initialize sync listeners

function App() {
  console.log('App Rendering Real V2');
  return (
    <ErrorBoundary>
      <SettingsProvider>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <UpdatePrompt />
            <React.Suspense fallback={
              <div style={{ 
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--plra-900)', color: 'white', fontFamily: 'sans-serif'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.8 }}>CARGANDO SISTEMA...</p>
                </div>
              </div>
            }>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/coordinador" element={<CoordinatorApp />} />
                <Route path="/comando" element={<CommandCenter />} />
                <Route path="/veedor" element={<VeedorApp />} />
                <Route path="/admin" element={<SuperAdmin />} />
                <Route path="/logistica" element={<LogisticsApp />} />
                <Route path="/comunicaciones" element={<Communications />} />
                <Route path="/diad" element={<DiaDApp />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </React.Suspense>
          </Router>
        </AuthProvider>
      </ThemeProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
