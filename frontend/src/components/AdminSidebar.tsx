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
  const [isCollapsed, setIsCollapsed] = React.useState(window.innerWidth < 1024);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
      else setIsCollapsed(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const filteredItems = NAV_ITEMS.filter(item => {
    if (user?.role === 'JEFE_CAMPANA') {
      return !['users', 'audit', 'settings'].includes(item.id);
    }
    return true;
  });

  return (
    <motion.div 
      animate={{ width: isCollapsed ? '70px' : '200px' }}
      style={{
        background: 'rgba(2, 12, 27, 0.5)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: isCollapsed ? '1.25rem 0.5rem' : '1.25rem 0.75rem',
        gap: '0.4rem',
        position: 'relative',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
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
        <ShieldCheck size={20} style={{ color: 'var(--plra-300)', minWidth: '20px' }} />
        {!isCollapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
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
              background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: isActive ? 'var(--plra-200)' : 'var(--text-3)',
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
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.04)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)';
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
                  fontWeight: isActive ? 700 : 500,
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
