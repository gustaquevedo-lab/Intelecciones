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

function App() {
  console.log('App Rendering Minimal');
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020C1E', color: 'white' }}>
      <h1>INTELECCIONES 2026 - MODO DEBUG</h1>
    </div>
  );
}

export default App;
