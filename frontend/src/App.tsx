import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import CoordinatorApp from './pages/CoordinatorApp';
import CommandCenter from './pages/CommandCenter';
import SuperAdmin from './pages/SuperAdmin';
import LogisticsApp from './pages/LogisticsApp';
import Communications from './pages/Communications';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/coordinador" element={<CoordinatorApp />} />
              <Route path="/comando" element={<CommandCenter />} />
              <Route path="/admin" element={<SuperAdmin />} />
              <Route path="/logistica" element={<LogisticsApp />} />
              <Route path="/comunicaciones" element={<Communications />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
