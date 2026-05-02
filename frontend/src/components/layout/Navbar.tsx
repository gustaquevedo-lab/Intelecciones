import React from 'react';
import { Layout, BarChart, Map, Truck, Users, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="glass-morphism" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      zIndex: 2000,
      borderBottom: '1px solid var(--border)'
    }}>
      <div className="flex items-center gap-2">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: 'var(--primary)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layout color="white" size={20} />
          </div>
          <h1 style={{ fontSize: '1.25rem', letterSpacing: '-0.02em', margin: 0 }}>Intelecciones</h1>
        </Link>
      </div>
      
      <div className="flex items-center gap-4">
        <NavLink to="/" icon={<BarChart size={18} />} label="Dashboard" active={location.pathname === '/'} />
        <NavLink to="/territorio" icon={<Map size={18} />} label="Territorio" active={location.pathname === '/territorio'} />
        <NavLink to="/colector" icon={<Layout size={18} />} label="Colector" active={location.pathname === '/colector'} />
        <NavLink to="/logistica" icon={<Truck size={18} />} label="Logística" active={location.pathname === '/logistica'} />
        <NavLink to="/veedores" icon={<Users size={18} />} label="Veedores" active={location.pathname === '/veedores'} />
        {user.role === 'SUPERUSUARIO' && (
          <NavLink to="/campañas" icon={<Settings size={18} />} label="Campañas" active={location.pathname === '/campañas'} />
        )}
      </div>

      <div className="flex items-center gap-4">
        <button onClick={logout} className="flex items-center justify-center p-2 rounded-full hover:bg-surface-hover" title="Cerrar Sesión">
          <Settings size={20} color="var(--text-muted)" />
        </button>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '0.875rem'
        }}>
          {user.username.substring(0, 2).toUpperCase()}
        </div>
      </div>
    </nav>
  );
};

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string; active?: boolean }> = ({ to, icon, label, active }) => (
  <Link to={to} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors" style={{
    color: active ? 'var(--text)' : 'var(--text-muted)',
    backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
    fontWeight: active ? 600 : 400,
    textDecoration: 'none'
  }}>
    {icon}
    <span style={{ fontSize: '0.9rem' }}>{label}</span>
  </Link>
);

export default Navbar;
