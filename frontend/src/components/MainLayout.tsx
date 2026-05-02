import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ModuleSwitcher } from './ModuleSwitcher';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  userName: string;
  userPhoto?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, title, userName, userPhoto }) => {
  const navigate = useNavigate();
  const { user, activeListId, setActiveListId } = useAuth();
  const [lists, setLists] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA') {
      api.get('/lists').then(res => setLists(res.data)).catch(err => console.error(err));
    }
  }, [user]);
  const initials = userName.slice(0, 2).toUpperCase();
  console.log("DEBUG: MainLayout rendering with userPhoto:", userPhoto);

  const roleLabels = {
    'SUPERUSUARIO': 'Super Administrador',
    'JEFE_CAMPANA': 'Jefe de Campaña',
    'COORDINADOR': 'Coordinador de Campo'
  };

  const currentRoleLabel = user ? roleLabels[user.role] : 'Usuario';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(4, 20, 40, 0.94)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(59,130,246,0.18)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        {/* ROW 1: Logo | Switcher | User */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          padding: '0 1.25rem',
          gap: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.03)'
        }}>
          {/* Logo - Scaled Up */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', transform: 'scale(1.1)', transformOrigin: 'left' }}>
            <Logo />
          </div>

          {/* Module Switcher & List Selector */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, overflow: 'hidden' }}>
            <ModuleSwitcher />
            
            {(user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA') && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                background: 'rgba(59,130,246,0.08)', 
                padding: '0.25rem 0.6rem', 
                borderRadius: '10px', 
                border: '1px solid rgba(59,130,246,0.15)',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--plra-400)', textTransform: 'uppercase' }}>VISTA:</span>
                <select 
                  value={activeListId === null ? 'null' : activeListId}
                  onChange={(e) => setActiveListId(e.target.value === 'null' ? null : parseInt(e.target.value))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)'
                  }}
                >
                  <option value="null" style={{ background: '#041428' }}>🌎 GLOBAL</option>
                  {lists.map((l: any) => (
                    <option key={l.id} value={l.id} style={{ background: '#041428' }}>
                      {l.list_number} {l.type === 'CONCEJAL' ? `Op${l.option_number}` : '(Int.)'} — {l.candidate_alias || l.candidate_nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* User Profile - Enhanced Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
              <span style={{
                fontSize: '0.85rem', fontWeight: 800, color: 'white',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.01em'
              }}>
                {userName}
              </span>
              <span style={{
                fontSize: '0.55rem', fontWeight: 700, color: 'var(--plra-300)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                marginTop: '0.15rem'
              }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--green)' }} />
                {currentRoleLabel}
              </span>
            </div>

            <div style={{
              width: '40px', height: '40px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '2px solid rgba(59,130,246,0.3)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              background: 'var(--surface-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {userPhoto ? (
                <img src={userPhoto} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--plra-300)' }}>{initials}</span>
              )}
            </div>
            
            <button 
              onClick={() => navigate('/logout')} 
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#FCA5A5',
                padding: '0.4rem',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ROW 2: Module Title - Absolute Centered Focus */}
        <div style={{
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 1rem'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: 'flex',
              alignItems: 'center', gap: '0.6rem',
              padding: '0.25rem 1.25rem',
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: '9999px',
            }}
          >
            <Shield size={14} style={{ color: 'var(--plra-300)' }} />
            <span style={{
              fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: 'white',
              fontFamily: 'var(--font-display)',
            }}>
              {title}
            </span>
          </motion.div>
        </div>
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 10 }}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
