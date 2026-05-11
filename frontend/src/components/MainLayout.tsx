import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { LogOut, Shield, Moon, Sun, Monitor, Menu, Clock } from 'lucide-react';
import { ModuleSwitcher } from './ModuleSwitcher';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import api from '../services/api';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  userName: string;
  userPhoto?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, title, userName, userPhoto }) => {
  const navigate = useNavigate();
  const { user, activeListId, setActiveListId, activeDistrict, setActiveDistrict } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const { settings } = useSettings();
  const [lists, setLists] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA' || user?.role === 'PADRINO') {
      api.get('/lists').then(res => setLists(res.data)).catch(err => console.error(err));
    }
  }, [user]);

  const initials = userName.slice(0, 2).toUpperCase();

  const roleLabels: Record<string, string> = {
    'SUPERUSUARIO':    'Super Admin',
    'JEFE_CAMPANA':    'Jefe de Campaña',
    'PADRINO':         'Padrino',
    'COORDINADOR':     'Coordinador',
    'MIEMBRO_DE_MESA': 'Miembro de Mesa'
  };
  const currentRoleLabel = user ? (roleLabels[user.role] ?? 'Usuario') : 'Usuario';

  const showDistrictSelector = user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA';
  const districts = [...new Set([
    ...lists.map(l => l.ciudad).filter(Boolean),
    ...lists.map(l => l.campaign_distrito).filter(Boolean)
  ])].sort();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="main-header">

        {/* ── ROW 1 ── Logo · Filters · User controls */}
        <div className="header-row1">

          {/* LEFT: hamburger + logo */}
          <div className="header-left">
            <button
              className="header-hamburger"
              onClick={() => document.dispatchEvent(new CustomEvent('toggle-sidebar'))}
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <div className="header-logo-wrap">
              <Logo />
            </div>
          </div>

          {/* CENTER: district + list selector — only md+ */}
          {showDistrictSelector && (
            <div className="header-center">
              <div className="header-filters-pill">
                <div className="header-filter-group">
                  <span className="header-filter-label">DISTRITO</span>
                  <select
                    value={activeDistrict ?? 'null'}
                    onChange={e => {
                      setActiveDistrict(e.target.value === 'null' ? null : e.target.value);
                      setActiveListId(null);
                    }}
                    disabled={user?.role !== 'SUPERUSUARIO' && user?.role !== 'JEFE_CAMPANA'}
                    className="header-filter-select"
                  >
                    <option value="null">🌎 TODOS</option>
                    {districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="header-filter-divider" />

                <div className="header-filter-group">
                  <span className="header-filter-label">LISTA</span>
                  <select
                    value={activeListId === null ? 'null' : activeListId}
                    onChange={e => setActiveListId(e.target.value === 'null' ? null : parseInt(e.target.value))}
                    className="header-filter-select"
                  >
                    <option value="null">📋 TODAS</option>
                    {lists
                      .filter(l => !activeDistrict || l.ciudad === activeDistrict || l.campaign_distrito === activeDistrict)
                      .map((l: any) => (
                        <option key={l.id} value={l.id}>
                          L-{l.list_number} — {l.candidate_alias || l.candidate_nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT: theme · countdown · user · logout */}
          <div className="header-right">
            {/* Theme toggle */}
            <div className="header-theme-toggle">
              {([
                { id: 'light',  icon: Sun },
                { id: 'system', icon: Monitor },
                { id: 'dark',   icon: Moon },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`header-theme-btn${theme === t.id ? ' active' : ''}`}
                  title={t.id.toUpperCase()}
                >
                  <t.icon size={13} />
                </button>
              ))}
            </div>

            <HeaderCountdown targetDate={settings.election_date} />

            {/* User info — hidden on small mobile */}
            <div className="header-user-info">
              <span className="header-user-name">{userName}</span>
              <span className="header-user-role">
                <span className="header-online-dot" />
                {currentRoleLabel}
              </span>
            </div>

            {/* Avatar */}
            <div className="header-avatar">
              {userPhoto
                ? <img src={userPhoto} alt={userName} />
                : <span>{initials}</span>}
            </div>

            {/* Logout */}
            <button onClick={() => navigate('/logout')} className="header-logout" aria-label="Cerrar sesión">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* ── ROW 2 ── Module switcher + current module title */}
        <div className="header-row2">
          <ModuleSwitcher />
          <div className="header-row2-separator" />
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="header-module-pill"
          >
            <Shield size={11} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
            <span className="header-module-title-text">{title}</span>
          </motion.div>
        </div>

        {/* ── ROW 3 ── Mobile-only compact filter bar */}
        {showDistrictSelector && (
          <div className="header-row3">
            <div className="header-row3-group">
              <span className="header-row3-label">DIST</span>
              <select
                value={activeDistrict ?? 'null'}
                onChange={e => {
                  setActiveDistrict(e.target.value === 'null' ? null : e.target.value);
                  setActiveListId(null);
                }}
                className="header-row3-select"
              >
                <option value="null">🌎 Todos</option>
                {districts.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="header-row3-divider" />
            <div className="header-row3-group">
              <span className="header-row3-label">LISTA</span>
              <select
                value={activeListId === null ? 'null' : activeListId}
                onChange={e => setActiveListId(e.target.value === 'null' ? null : parseInt(e.target.value))}
                className="header-row3-select"
              >
                <option value="null">📋 Todas</option>
                {lists
                  .filter(l => !activeDistrict || l.ciudad === activeDistrict || l.campaign_distrito === activeDistrict)
                  .map((l: any) => (
                    <option key={l.id} value={l.id}>
                      L-{l.list_number} — {l.candidate_alias || l.candidate_nombre}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
};

/* ── Countdown widget ──────────────────────────────────────── */
const HeaderCountdown = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date(targetDate);
      if (now.toDateString() !== target.toDateString()) { setTimeLeft(null); return; }
      const closing = new Date(target);
      closing.setHours(17, 0, 0, 0);
      const diff = closing.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('CERRADO');
      } else {
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${h}:${m}:${s}`);
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  if (!timeLeft) return null;
  const closed = timeLeft === 'CERRADO';
  return (
    <div className={`header-countdown${closed ? ' closed' : ''}`}>
      <Clock size={12} className={!closed ? 'animate-pulse' : ''} />
      <span>{timeLeft}</span>
    </div>
  );
};

export default MainLayout;
