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
    if (user?.role === 'SUPERUSUARIO') {
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

      {/* ── Header: 4-column grid — logo | switcher | title | user ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        padding: '0 1rem',
        background: 'rgba(4, 20, 40, 0.92)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(59,130,246,0.15)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
        gap: '0.75rem',
        overflow: 'hidden'
      }}>

        {/* Col 1: Logo */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', transform: 'scale(0.85)', transformOrigin: 'left' }}>
          <Logo />
        </div>

        {/* Col 2: Module Switcher (Visible for Admin/Jefe) */}
        <div style={{ flexShrink: 1, display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, overflow: 'hidden' }}>
          <ModuleSwitcher />
          
          {user?.role === 'SUPERUSUARIO' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59,130,246,0.1)', padding: '0.2rem 0.5rem', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase' }}>VISTA:</span>
              <select 
                value={activeListId === null ? 'null' : activeListId}
                onChange={(e) => setActiveListId(e.target.value === 'null' ? null : parseInt(e.target.value))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="null" style={{ background: '#041428' }}>🌎 VISTA GLOBAL</option>
                {lists.map((l: any) => (
                  <option key={l.id} value={l.id} style={{ background: '#041428' }}>
                    {l.list_number} {l.type === 'CONCEJAL' ? `Op${l.option_number}` : '(Int.)'} — {l.candidate_alias || l.candidate_nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Col 3: Title and User Info */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
          {/* Title pill */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="hidden-mobile"
            style={{
              display: 'flex',
              alignItems: 'center', gap: '0.5rem',
              padding: '0.35rem 1rem',
              background: 'rgba(0,71,171,0.15)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Shield size={12} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--plra-200)',
              fontFamily: 'var(--font-display)',
            }}>
              {title}
            </span>
          </motion.div>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>

          {/* Name + role */}
          <div className="hidden sm:flex" style={{ flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '120px',
              lineHeight: 1
            }}>
              {userName}
            </span>
            <span style={{
              fontSize: '0.5rem', fontWeight: 700, color: 'var(--plra-300)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              marginTop: '0.1rem'
            }}>
              <span style={{
                width: '4px', height: '4px', borderRadius: '50%',
                background: 'var(--green)', display: 'inline-block',
                flexShrink: 0,
              }} />
              {currentRoleLabel}
            </span>
          </div>

          {/* Avatar — photo or initials */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            border: '1.5px solid rgba(59,130,246,0.35)',
            boxShadow: '0 2px 10px rgba(0,71,171,0.4)',
            cursor: 'pointer', flexShrink: 0, overflow: 'hidden',
            background: 'linear-gradient(135deg, var(--plra-500), var(--plra-400))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {userPhoto ? (
              <img src={userPhoto} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>
                {initials}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={() => navigate('/login')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.65rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', color: 'var(--text-3)',
              fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
            }}
          >
            <LogOut size={13} strokeWidth={2.5} />
            <span className="hidden sm:flex">Salir</span>
          </button>
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
