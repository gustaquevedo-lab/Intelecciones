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
  Truck
} from 'lucide-react';
import { motion } from 'framer-motion';
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
  { id: 'audit',     label: 'Auditoría',  icon: History },
  { id: 'settings',  label: 'Ajustes',    icon: Settings },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const filteredItems = NAV_ITEMS.filter(item => {
    if (user?.role === 'JEFE_CAMPANA') {
      return !['users', 'audit', 'settings'].includes(item.id);
    }
    return true;
  });

  return (
    <div style={{
      width: '240px',
      background: 'rgba(2, 12, 27, 0.5)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.25rem 0.75rem',
      gap: '0.5rem',
    }}>
      <div style={{
        padding: '0 0.5rem 1rem 0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
      }}>
        <ShieldCheck size={18} style={{ color: 'var(--plra-300)' }} />
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 800,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          fontFamily: 'var(--font-display)',
        }}>
          {settings.app_name}
        </span>
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
              gap: '0.75rem',
              padding: '0.75rem 0.85rem',
              borderRadius: '10px',
              border: 'none',
              background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: isActive ? 'var(--plra-200)' : 'var(--text-3)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              textAlign: 'left',
              width: '100%',
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
            <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            <span style={{
              fontSize: '0.85rem',
              fontWeight: isActive ? 700 : 500,
              fontFamily: 'var(--font-display)',
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
