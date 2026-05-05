import React from 'react';
import { 
  LayoutDashboard, 
  Flag, 
  Users, 
  ListOrdered, 
  History, 
  Settings,
  ShieldCheck,
  MapPin,
  Truck,
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

import { useTheme } from '../context/ThemeContext';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NAV_ITEMS = [
  { id: 'overview',  label: 'Resumen',    icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campañas',   icon: Flag },
  { id: 'lists',     label: 'Listas',     icon: ListOrdered },
  { id: 'users',     label: 'Usuarios',   icon: Users },
  { id: 'locales',   label: 'Locales',    icon: MapPin },
  { id: 'whatsapp',  label: 'WhatsApp',   icon: MessageSquare },
  { id: 'audit',     label: 'Auditoría',  icon: History },
  { id: 'settings',  label: 'Ajustes',    icon: Settings },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const [isCollapsed, setIsCollapsed] = React.useState(window.innerWidth < 1024);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
      else setIsCollapsed(false);
    };
    
    const handleToggle = () => setIsMobileOpen(prev => !prev);

    window.addEventListener('resize', handleResize);
    document.addEventListener('toggle-sidebar', handleToggle);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('toggle-sidebar', handleToggle);
    };
  }, []);
  
  const filteredItems = NAV_ITEMS.filter(item => {
    if (user?.role === 'JEFE_CAMPANA') {
      return !['users', 'audit', 'settings'].includes(item.id);
    }
    return true;
  });

  const sidebarWidth = isCollapsed ? '70px' : '200px';

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 45
            }}
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={false}
        animate={{ 
          width: sidebarWidth,
          x: (window.innerWidth < 640 && !isMobileOpen) ? -200 : 0
        }}
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--blur-md))',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: isCollapsed ? '1.25rem 0.5rem' : '1.25rem 0.75rem',
          gap: '0.4rem',
          position: window.innerWidth < 640 ? 'fixed' : 'relative',
          top: window.innerWidth < 640 ? 0 : 'auto',
          bottom: window.innerWidth < 640 ? 0 : 'auto',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease',
          overflow: 'visible',
          zIndex: 50
        }}
      >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: 'absolute',
          right: '-14px',
          top: '60px',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'var(--plra-500)',
          border: '1px solid var(--border)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 999,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : 'var(--shadow-md)'
        }}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
      <div style={{
        padding: isCollapsed ? '0' : '0 0.5rem 1rem 0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: '0.6rem',
        marginBottom: isCollapsed ? '1rem' : '0'
      }}>
        <ShieldCheck size={20} style={{ color: isDark ? 'var(--plra-300)' : 'var(--plra-500)', minWidth: '20px' }} />
        {!isCollapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-2)',
              fontFamily: 'var(--font-display)',
              whiteSpace: 'nowrap'
            }}
          >
            {settings.app_name}
          </motion.span>
        )}
      </div>

      {filteredItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '0.75rem 0' : '0.55rem 0.85rem',
              borderRadius: '10px',
              border: 'none',
              background: isActive ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 71, 171, 0.08)') : 'transparent',
              color: isActive 
                ? (isDark ? 'var(--plra-200)' : 'var(--plra-500)') 
                : 'var(--text-2)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              textAlign: 'left',
              width: '100%',
              overflow: 'hidden',
              gap: '0.75rem'
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)';
              }
            }}
          >
            {isActive && (
              <motion.div
                layoutId="active-nav-bg"
                style={{
                  position: 'absolute',
                  left: 0,
                  width: '3px',
                  height: '18px',
                  background: 'var(--plra-400)',
                  borderRadius: '0 4px 4px 0',
                }}
              />
            )}
            <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.5} style={{ minWidth: '18px' }} />
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 800 : 600,
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.label}
              </motion.span>
            )}
          </button>
        );
      })}
    </motion.div>
  );
};
