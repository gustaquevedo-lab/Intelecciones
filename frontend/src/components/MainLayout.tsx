import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { LogOut, Shield, Moon, Sun, Monitor } from 'lucide-react';
import { ModuleSwitcher } from './ModuleSwitcher';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  const { theme, setTheme, isDark } = useTheme();
  const [lists, setLists] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA') {
      api.get('/lists').then(res => setLists(res.data)).catch(err => console.error(err));
    }
  }, [user]);

  const initials = userName.slice(0, 2).toUpperCase();

  const roleLabels = {
    'SUPERUSUARIO': 'Super Administrador',
    'JEFE_CAMPANA': 'Jefe de Campaña',
    'COORDINADOR': 'Coordinador de Campo',
    'MIEMBRO_DE_MESA': 'Miembro de Mesa'
  };

  const currentRoleLabel = user ? roleLabels[user.role] : 'Usuario';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        transition: 'var(--theme-transition)'
      }}>
        {/* ROW 1: Logo | Switcher | User */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          padding: '0 1.25rem',
          gap: '1rem',
          borderBottom: '1px solid var(--border)',
          position: 'relative'
        }}>
          {/* Logo */}
          <div className="header-logo-container" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Logo />
          </div>

          {/* List Selector */}
          {(user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA') && (
            <div 
              className="hidden-mobile"
              style={{ 
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                background: 'var(--surface-light)', 
                padding: '0.3rem 0.75rem', 
                borderRadius: '10px', 
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                boxShadow: 'var(--shadow-sm)',
                zIndex: 10
              }}
            >
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
                <option value="null" style={{ background: 'var(--surface)' }}>🌎 GLOBAL</option>
                {lists.map((l: any) => (
                  <option key={l.id} value={l.id} style={{ background: 'var(--surface)' }}>
                    {l.list_number} {l.type === 'CONCEJAL' ? `Op${l.option_number}` : '(Int.)'} — {l.candidate_alias || l.candidate_nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controls Unit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <div style={{ 
              display: 'flex', 
              background: 'var(--surface-light)', 
              padding: '2px', 
              borderRadius: '10px',
              border: '1px solid var(--border)'
            }}>
              {[
                { id: 'light', icon: Sun },
                { id: 'system', icon: Monitor },
                { id: 'dark', icon: Moon }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as any)}
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    border: 'none',
                    background: theme === t.id ? 'var(--primary)' : 'transparent',
                    color: theme === t.id ? 'white' : 'var(--text-3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  title={t.id.toUpperCase()}
                >
                  <t.icon size={14} />
                </button>
              ))}
            </div>

            <div className="hidden-mobile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{userName}</span>
              <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--plra-300)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--green)' }} />
                {currentRoleLabel}
              </span>
            </div>

            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden',
              border: '2px solid var(--border)', boxShadow: 'var(--shadow-sm)',
              background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {userPhoto ? <img src={userPhoto} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--plra-300)' }}>{initials}</span>}
            </div>
            
            <button 
              onClick={() => navigate('/logout')} 
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#FCA5A5', padding: '0.4rem', borderRadius: '10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ROW 2: Navigation Unit (Switcher + Title) - Absolutely Centered */}
        <div style={{
          height: '46px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 1rem',
          background: 'rgba(0, 0, 0, 0.15)',
          borderTop: '1px solid rgba(255,255,255,0.02)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          }}>
            {/* Module Switcher */}
            <ModuleSwitcher />

            {/* Separator Line */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(59,130,246,0.2)' }} className="hidden-mobile" />

            {/* Module Title */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex',
                alignItems: 'center', gap: '0.5rem',
                padding: '0.25rem 1rem',
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: '9999px',
                whiteSpace: 'nowrap'
              }}
            >
              <Shield size={12} style={{ color: 'var(--plra-300)' }} />
              <span style={{
                fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'white',
                fontFamily: 'var(--font-display)',
              }}>
                {title}
              </span>
            </motion.div>
          </div>
        </div>
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 10 }}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
