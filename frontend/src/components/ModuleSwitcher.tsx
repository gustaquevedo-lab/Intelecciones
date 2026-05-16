import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, Users, Shield, Truck, MessageSquare, CheckSquare, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const MODULES = [
  { id: 'coordinador',    label: 'Coordinador', short: 'Coord',  path: '/coordinador',   icon: Users,        roles: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'],                  moduleKey: 'REGISTRY' },
  { id: 'comando',        label: 'Comando',     short: 'Cmd',    path: '/comando',        icon: Map,          roles: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'],                  moduleKey: 'COMMAND_CENTER' },
  { id: 'logistics',      label: 'Logística',   short: 'Log',    path: '/logistica',      icon: Truck,        roles: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'],                  moduleKey: 'LOGISTICS' },
  { id: 'veedor',         label: 'Veedor',      short: 'Veed',   path: '/veedor',         icon: CheckSquare,  roles: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','MIEMBRO_DE_MESA','SUBJEFE'], moduleKey: 'DAY_D' },
  { id: 'communications', label: 'WhatsApp',    short: 'WA',     path: '/comunicaciones', icon: MessageSquare,roles: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'],                  moduleKey: 'COMMUNICATIONS' },
  { id: 'diad',           label: 'Día D',       short: 'DíaD',   path: '/diad',           icon: Zap,          roles: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'],                  moduleKey: 'DAY_D', accent: '#22C47E' },
  { id: 'admin',          label: 'Admin',       short: 'Admin',  path: '/admin',          icon: Shield,       roles: ['SUPERUSUARIO'],                                           moduleKey: 'SUPER_ADMIN' },
];

export const ModuleSwitcher: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tooltip, setTooltip] = React.useState<string | null>(null);

  if (!user) return null;
  const canSeeAny =
    user.role === 'SUPERUSUARIO' ||
    user.role === 'JEFE_CAMPANA' ||
    user.role === 'PADRINO' ||
    user.role === 'SUBJEFE' ||
    user.role === 'MIEMBRO_DE_MESA';
  if (!canSeeAny) return null;

  const available = MODULES.filter(m => {
    if (user.role === 'SUPERUSUARIO') return true;
    if (user.role === 'MIEMBRO_DE_MESA') return m.id === 'veedor';
    return m.roles.includes(user.role) && !!user.enabled_modules?.includes(m.moduleKey);
  });

  return (
    <nav className="module-switcher" aria-label="Módulos">
      {available.map(m => {
        const isActive = location.pathname === m.path;
        const Icon = m.icon;
        const accent = m.accent;

        return (
          <div
            key={m.id}
            className="module-btn-wrap"
            onMouseEnter={() => setTooltip(m.id)}
            onMouseLeave={() => setTooltip(null)}
          >
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate(m.path)}
              className={`module-btn${isActive ? ' active' : ''}${accent ? ' accent' : ''}`}
              style={accent ? ({
                '--module-accent': accent,
              } as React.CSSProperties) : undefined}
              aria-label={m.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.7} />
              {/* Short label — visible only on mobile via CSS */}
              <span className="module-btn-label">{m.short}</span>
            </motion.button>

            {/* Tooltip — desktop hover only, hidden on touch */}
            <AnimatePresence>
              {tooltip === m.id && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="module-tooltip"
                  role="tooltip"
                >
                  {m.label}
                  <div className="module-tooltip-arrow" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
};
