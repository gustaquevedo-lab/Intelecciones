import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, Users, Shield, Truck, MessageSquare, CheckSquare, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export const ModuleSwitcher: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  if (!user || (user.role !== 'SUPERUSUARIO' && user.role !== 'JEFE_CAMPANA' && user.role !== 'MIEMBRO_DE_MESA')) {
    return null;
  }

  const modules = [
    { id: 'coordinador', label: 'Coordinador', path: '/coordinador', icon: Users, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'REGISTRY' },
    { id: 'comando', label: 'Comando', path: '/comando', icon: Map, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'COMMAND_CENTER' },
    { id: 'logistics', label: 'Logística', path: '/logistica', icon: Truck, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'LOGISTICS' },
    { id: 'veedor', label: 'Veedor', path: '/veedor', icon: CheckSquare, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA', 'MIEMBRO_DE_MESA'], moduleKey: 'DAY_D' },
    { id: 'communications', label: 'WhatsApp', path: '/comunicaciones', icon: MessageSquare, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'COMMUNICATIONS' },
    { id: 'diad', label: 'Dia D', path: '/diad', icon: Zap, roles: ['SUPERUSUARIO', 'JEFE_CAMPANA'], moduleKey: 'DAY_D', accent: '#22C47E' },
    { id: 'admin', label: 'Admin', path: '/admin', icon: Shield, roles: ['SUPERUSUARIO'], moduleKey: 'SUPER_ADMIN' },
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
          <div 
            key={m.id} 
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(m.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
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
                transition: 'all 0.2s'
              }}
            >
              <Icon size={18} />
            </motion.button>

            <AnimatePresence>
              {hoveredId === m.id && (
                <motion.div
                  initial={{ opacity: 0, y: 10, x: '-50%' }}
                  animate={{ opacity: 1, y: 0, x: '-50%' }}
                  exit={{ opacity: 0, y: 5, x: '-50%' }}
                  style={{
                    position: 'absolute',
                    bottom: '-40px',
                    left: '50%',
                    background: 'var(--surface-3)',
                    color: 'var(--text)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-mid)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  {m.label}
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    left: '50%',
                    transform: 'translateX(-50%) rotate(45deg)',
                    width: '8px',
                    height: '8px',
                    background: 'var(--surface-3)',
                    borderTop: '1px solid var(--border-mid)',
                    borderLeft: '1px solid var(--border-mid)',
                  }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};
