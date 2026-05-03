import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, Users, Shield, Truck, MessageSquare, CheckSquare, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export const ModuleSwitcher: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || (user.role !== 'SUPERUSUARIO' && user.role !== 'JEFE_CAMPANA' && user.role !== 'MIEMBRO_DE_MESA')) {
    return null;
  }

  const modules = [
    { id: 'admin', label: 'Admin', path: '/admin', icon: Shield, roles: ['SUPERUSUARIO'], moduleKey: 'SUPER_ADMIN' },
    { id: 'comando', label: 'Comando', path: '/comando', icon: Map, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'COMMAND_CENTER' },
    { id: 'diad', label: 'Día D', path: '/diad', icon: Zap, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'DAY_D', accent: '#22C47E' },
    { id: 'veedor', label: 'Veeduría', path: '/veedor', icon: CheckSquare, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA', 'MIEMBRO_DE_MESA'], moduleKey: 'DAY_D' },
    { id: 'logistics', label: 'Logística', path: '/logistica', icon: Truck, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'LOGISTICS' },
    { id: 'communications', label: 'WhatsApp', path: '/comunicaciones', icon: MessageSquare, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'COMMUNICATIONS' },
    { id: 'coordinador', label: 'Campo', path: '/coordinador', icon: Users, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'REGISTRY' },
  ];

  const availableModules = modules.filter(m => {
    if (user.role === 'SUPERUSUARIO') return true;
    if (user.role === 'MIEMBRO_DE_MESA' && m.id === 'veedor') return true;
    const hasRole = m.roles.includes(user.role);
    const isEnabled = user.enabled_modules?.includes(m.moduleKey);
    return hasRole && isEnabled;
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      background: 'rgba(0, 0, 0, 0.25)',
      padding: '0.3rem',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      margin: '0 1rem'
    }}>
      {availableModules.map((m) => {
        const isActive = location.pathname === m.path;
        const Icon = m.icon;
        const accentColor = (m as any).accent;

        return (
          <motion.button
            key={m.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(m.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '9px',
              border: isActive && accentColor ? `1px solid ${accentColor}55` : 'none',
              background: isActive
                ? accentColor
                  ? `linear-gradient(135deg, ${accentColor}33, ${accentColor}22)`
                  : 'var(--plra-500)'
                : 'transparent',
              color: isActive
                ? accentColor || 'white'
                : accentColor
                  ? accentColor + 'BB'
                  : 'var(--text-3)',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'all 0.2s'
            }}
          >
            <Icon size={14} />
            <span className="hidden lg:inline">{m.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};
