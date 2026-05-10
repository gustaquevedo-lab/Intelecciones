import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Users, AlertTriangle, Shield, BarChart3, Radio,
  TrendingUp, TrendingDown, ChevronDown,
  Download, MapPin, Activity, Bell, X, Search,
  AlertCircle, ChevronRight, Truck, Target, MessageSquare, Mic, Clock
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownCard } from '../components/CountdownCard';
import api from '../services/api';

const formatWhatsApp = (phone: string) => {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, ''); 
  if (clean.startsWith('595')) {
    clean = clean.substring(3);
  }
  const normalized = clean.replace(/^0/, ''); 
  return `595${normalized}`;
};

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ICON_SVGS: Record<string, string> = {
  Landmark: `<polygon points="12 2 22 7 2 7 12 2"></polygon><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line>`,
  School: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>`,
  Building: `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22"></line><line x1="15" y1="22" x2="15" y2="22"></line><line x1="12" y1="18" x2="12" y2="18"></line><line x1="12" y1="14" x2="12" y2="14"></line><line x1="12" y1="10" x2="12" y2="10"></line><line x1="12" y1="6" x2="12" y2="6"></line><line x1="8" y1="18" x2="8" y2="18"></line><line x1="8" y1="14" x2="8" y2="14"></line><line x1="8" y1="10" x2="8" y2="10"></line><line x1="8" y1="6" x2="8" y2="6"></line><line x1="16" y1="18" x2="16" y2="18"></line><line x1="16" y1="14" x2="16" y2="14"></line><line x1="16" y1="10" x2="16" y2="10"></line><line x1="16" y1="6" x2="16" y2="6"></line>`,
  Home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
  MapPin: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`,
  Car: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.5C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>`
};

const TRAFFIC_COLORS: Record<string, string> = {
  GREEN:  '#22C55E',
  YELLOW: '#EAB308',
  RED:    '#EF4444',
  PURPLE: '#A855F7',
};

const createCustomIcon = (color: string, iconName: string = 'Landmark', needsTransport: boolean = false, size: 'sm' | 'md' = 'md') => {
  const sz = size === 'sm' ? 28 : 36;
  const tailH = size === 'sm' ? 10 : 14;
  const totalH = sz + tailH;
  const icoSz = size === 'sm' ? 14 : 18;
  // Resolve CSS variable colors to hex for use inside SVG/shadow
  const resolvedColor = color.startsWith('var(') ? (
    color.includes('green') ? '#22C55E' :
    color.includes('yellow') ? '#EAB308' :
    color.includes('red') ? '#EF4444' :
    color.includes('plra-300') ? '#3B82F6' :
    color.includes('plra-500') ? '#0047AB' : '#3B82F6'
  ) : color;

  return L.divIcon({
    html: `
      <div style="position:relative;width:${sz}px;height:${totalH}px;filter:drop-shadow(0 4px 8px ${resolvedColor}60);">
        <div style="
          width:${sz}px;height:${sz}px;border-radius:${sz/2}px ${sz/2}px ${sz*0.35}px ${sz*0.35}px;
          background:${resolvedColor};
          border:2.5px solid rgba(255,255,255,0.9);
          box-shadow:0 0 0 3px ${resolvedColor}40,inset 0 2px 4px rgba(255,255,255,0.25);
          display:flex;align-items:center;justify-content:center;
          position:relative;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${icoSz}" height="${icoSz}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            ${ICON_SVGS[needsTransport ? 'Car' : iconName] || ICON_SVGS.Landmark}
          </svg>
          ${needsTransport ? `
            <div style="position:absolute;top:-6px;right:-6px;background:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);">
              <div style="width:9px;height:9px;border-radius:50%;background:#3B82F6;"></div>
            </div>
          ` : ''}
        </div>
        <div style="
          position:absolute;bottom:0;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:${sz*0.22}px solid transparent;
          border-right:${sz*0.22}px solid transparent;
          border-top:${tailH}px solid ${resolvedColor};
        "></div>
      </div>
    `,
    className: '',
    iconSize: [sz, totalH],
    iconAnchor: [sz / 2, totalH],
    popupAnchor: [0, -totalH - 4],
  });
};


/* ─── sub-components ─────────────────────────────────── */

const StatCard = ({ label, value, trend, color, isTactical, onClick, active }: any) => (
  <div 
    onClick={onClick}
    style={{
      background: active ? `${color}20` : (isTactical ? 'rgba(0,0,0,0.3)' : 'var(--surface)'), 
      border: `1px solid ${active ? color : (isTactical ? 'rgba(255,255,255,0.05)' : 'var(--border)')}`,
      borderRadius: '16px', 
      padding: '1.1rem 1.25rem',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: isTactical ? 'none' : 'var(--shadow-sm)',
      cursor: onClick ? 'pointer' : 'default',
      opacity: active || !onClick ? 1 : 0.5
    }}
  >
    <div style={{ 
      position: 'absolute', left: 0, top: '25%', bottom: '25%', 
      width: '3px', background: color, borderRadius: '0 4px 4px 0',
      opacity: 0.8
    }} />
    <div style={{ minWidth: 0 }}>
      <span style={{ 
        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', 
        textTransform: 'uppercase', color: isTactical ? 'var(--text-3)' : 'var(--text-3)', fontFamily: 'var(--font-display)' 
      }}>
        {label}
      </span>
      <div style={{ 
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', 
        color: isTactical ? 'white' : 'var(--text)', lineHeight: 1, marginTop: '0.35rem' 
      }}>
        {value}
      </div>
    </div>
    <div style={{ 
      width: '40px', height: '40px', borderRadius: '12px', 
      background: `${color}15`, border: `1px solid ${color}30`, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0
    }}>
      {trend === 'up'   && <TrendingUp  size={20} style={{ color }} />}
      {trend === 'down' && <TrendingDown size={20} style={{ color }} />}
      {!trend           && <Activity    size={20} style={{ color: isTactical ? 'var(--text-3)' : 'var(--text-3)' }} />}
    </div>
  </div>
);

const RequestItem = ({ req, onResolve, isReadOnly }: { req: any, onResolve: (status: string) => void, isReadOnly: boolean }) => {
  const priorityColors = {
    CRITICAL: 'var(--red)',
    HIGH: 'var(--yellow)',
    NORMAL: 'var(--plra-300)'
  };
  return (
    <div className="tactical-card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColors[req.priority as keyof typeof priorityColors] || 'var(--plra-300)' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: priorityColors[req.priority as keyof typeof priorityColors] || 'var(--plra-300)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{req.priority}</span>
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600 }}>{new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      
      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>{req.type}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: '1.5', wordBreak: 'break-word' }}>{req.description}</p>
      
      {/* Multimedia Display (Premium) */}
      {(req.photo_url || req.audio_url) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {req.photo_url && (
            <div 
              onClick={() => window.open(req.photo_url, '_blank')}
              style={{ 
                width: '100%', height: '140px', borderRadius: '12px', 
                overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative' 
              }}
            >
              <img src={req.photo_url} alt="Evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                <Search size={20} color="white" />
              </div>
            </div>
          )}
          
          {req.audio_url && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Mic size={12} style={{ color: 'var(--plra-300)' }} />
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Reporte de Audio</span>
              </div>
              <audio controls src={req.audio_url} style={{ width: '100%', height: '32px' }} />
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', fontWeight: 800 }}>
            {req.coordinator_name?.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.coordinator_name}</p>
            {req.padrino_name && (
              <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>Padrino: <span style={{ fontWeight: 700, color: 'var(--plra-200)' }}>{req.padrino_name}</span></p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {req.coordinator_phone && (
          <a 
            href={`https://wa.me/${formatWhatsApp(req.coordinator_phone)}`}
            target="_blank"
            rel="noreferrer"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', 
              background: '#25D366', color: 'white', padding: '0.6rem', 
              borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, 
              textDecoration: 'none'
            }}
          >
            <MessageSquare size={14} /> CONTACTAR COORDINADOR
          </a>
        )}

        {req.status === 'PENDING' ? (
          !isReadOnly ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => onResolve('APPROVED')} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'var(--green)', color: 'white', border: 'none', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Aprobar</button>
              <button onClick={() => onResolve('REJECTED')} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid var(--red)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Rechazar</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '0.6rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-3)', fontSize: '0.7rem', fontStyle: 'italic' }}>
              Esperando decisión de mando
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '0.6rem', borderRadius: '10px', background: req.status === 'APPROVED' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: req.status === 'APPROVED' ? 'var(--green)' : 'var(--red)', fontSize: '0.75rem', fontWeight: 800 }}>
            {req.status === 'APPROVED' ? '✓ SOLICITUD APROBADA' : '✕ SOLICITUD RECHAZADA'}
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityFeed = ({ activities }: { activities: any[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    {activities.map((act, i) => (
      <div key={i} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
        {i < activities.length - 1 && <div style={{ position: 'absolute', left: '11px', top: '24px', bottom: '-12px', width: '2px', background: 'var(--border)' }} />}
        <div style={{ 
          width: '24px', height: '24px', borderRadius: '50%', 
          background: act.type === 'CAPTURE' ? 'var(--green)' : act.type === 'CONFLICT' ? 'var(--red)' : 'var(--plra-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1
        }}>
          {act.type === 'CAPTURE' ? <MapPin size={12} color="white" /> : act.type === 'CONFLICT' ? <AlertTriangle size={12} color="white" /> : <Bell size={12} color="white" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{act.user_name}</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--text-2)' }}>{act.type === 'CAPTURE' ? 'Captó a ' : act.type === 'CONFLICT' ? 'Generó conflicto: ' : 'Solicitó: '}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{act.entity_name}</span>
          </p>
        </div>
      </div>
    ))}
  </div>
);

const ProjectionCard = ({ currentCount }: { currentCount: number }) => {
  const startTime = new Date();
  startTime.setHours(7, 0, 0);
  const now = new Date();
  
  let elapsedHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  if (elapsedHours <= 0) elapsedHours = 0.5;
  if (elapsedHours > 10) elapsedHours = 10;
  
  const speed = currentCount / elapsedHours;
  const projection = Math.round(speed * 10);

  return (
    <div style={{
      padding: '1rem',
      background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.05))',
      border: '1px solid rgba(59,130,246,0.3)',
      borderRadius: '16px',
      marginTop: '1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Activity size={14} style={{ color: 'var(--plra-300)', marginRight: '0.25rem' }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--plra-200)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Análisis Predictivo
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
            {projection.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
            Proyección Final Estimada
          </div>
        </div>
      </div>
    </div>
  );
};

const SidebarContent = ({ stats, activities, conflicts, onResolve, settings, isReadOnly, onFilter, currentFilter }: { stats: any, activities: any[], conflicts: any[], onResolve: (c: any) => void, settings: any, isReadOnly: boolean, onFilter: any, currentFilter: any }) => {
  const { isDark } = useTheme();
  // Using variables to avoid warnings
  const _unused = { isReadOnly, isDark };
  const criticalLocs = stats?.locations?.filter((l: any) => parseFloat(l.percentage) < 30).sort((a: any, b: any) => parseFloat(a.percentage) - parseFloat(b.percentage)).slice(0, 3) || [];
  const topCoordinators = stats?.top_coordinators || [];

  return (
    <div className="tactical-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem', minHeight: '100%' }}>
      <CountdownCard 
        targetDate={settings.election_date} 
        title="OPERATIVO DÍA D" 
        isSidebar={true}
      />

      <div style={{ position: 'relative', marginTop: '0.5rem' }}>
        <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
        <input 
          type="text" 
          placeholder="Rastreo de Elector..."
          onKeyDown={(e) => e.key === 'Enter' && (window as any).handleStrategicSearch((e.target as HTMLInputElement).value)}
          style={{
            width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px', color: 'white', fontSize: '0.85rem',
            outline: 'none', transition: 'all 0.2s'
          }}
        />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Activity size={14} style={{ color: 'var(--plra-300)' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-display)' }}>
            INTELIGENCIA EN VIVO
          </span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ActivityFeed activities={activities} />
        </div>
      </div>

      {criticalLocs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <AlertCircle size={14} style={{ color: 'var(--red)' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--red)', fontFamily: 'var(--font-display)' }}>
              ALERTAS TÁCTICAS
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {criticalLocs.map((l: any) => (
              <div key={l.cod_local} style={{ padding: '0.85rem', borderRadius: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'white', fontWeight: 800 }}>{l.nombre}</span>
                  <span style={{ color: 'var(--red)', fontWeight: 900 }}>{l.percentage}%</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                  <div style={{ width: `${l.percentage}%`, height: '100%', background: 'var(--red)', boxShadow: '0 0 10px var(--red)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCoordinators.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={14} style={{ color: 'var(--yellow)' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-display)' }}>
              TOP RENDIMIENTO
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {topCoordinators.map((c: any, i: number) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: i === 0 ? 'var(--yellow)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, color: i === 0 ? 'black' : 'white' }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                  <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', marginTop: '4px', borderRadius: '2px' }}>
                    <div style={{ width: `${(c.capture_count / (topCoordinators[0].capture_count || 1)) * 100}%`, height: '100%', background: i === 0 ? 'var(--yellow)' : 'var(--plra-400)', boxShadow: i === 0 ? '0 0 10px var(--yellow)' : 'none' }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--plra-200)' }}>{c.capture_count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <BarChart3 size={14} style={{ color: 'var(--plra-300)' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-display)' }}>
            MÉTRICAS DE CAMPAÑA
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <StatCard 
            label="Captados Favor" 
            value={stats?.green || 0} 
            trend="up" 
            color="var(--green)" 
            isTactical 
            onClick={() => onFilter(currentFilter === 'GREEN' ? null : 'GREEN')}
            active={currentFilter === 'GREEN'}
          />
          <StatCard 
            label="Captados Contra" 
            value={stats?.red || 0} 
            trend="down" 
            color="var(--red)" 
            isTactical 
            onClick={() => onFilter(currentFilter === 'RED' ? null : 'RED')}
            active={currentFilter === 'RED'}
          />
          <StatCard 
            label="Electores Pendientes" 
            value={(stats?.total_electors - stats?.total_captures) || 0} 
            trend={null} 
            color="var(--plra-300)" 
            isTactical 
          />
        </div>
        <ProjectionCard currentCount={stats?.total_captures || 0} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-display)' }}>
              INCIDENCIAS
            </span>
          </div>
          <span style={{ background: conflicts.length > 0 ? 'var(--red)' : 'var(--green)', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '0.2rem 0.6rem', borderRadius: '8px' }}>
            {conflicts.length}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {conflicts.slice(0, 3).map(c => (
            <div key={c.conflict_id} onClick={() => onResolve(c)} style={{ padding: '1rem', borderRadius: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', marginBottom: '0.25rem' }}>{c.elector_nombre}</p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Doble captura detectada • Acción requerida</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MapHandler = ({ center, selectedLocalId }: { center: [number, number] | null, selectedLocalId: string | null }) => {
  const map = useMap();
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLocalId && selectedLocalId !== lastId && center) {
      map.flyTo(center, 16, { duration: 1.5 });
      setLastId(selectedLocalId);
    } else if (!selectedLocalId && lastId) {
      setLastId(null);
    }
  }, [center, selectedLocalId, lastId, map]);
  return null;
};

const CommandCenter = () => {
  const { user: authUser, loading, activeListId, activeDistrict } = useAuth();
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [locales, setLocales] = useState<any[]>([]);
  const [captures, setCaptures] = useState<any[]>([]);
  const [commandStats, setCommandStats] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showResolveModal, setShowResolveModal] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('map');
  const [selectedPadrino, setSelectedPadrino] = useState<any>(null);
  const [selectedCoordDetails, setSelectedCoordDetails] = useState<any>(null);
  const [structureData, setStructureData] = useState<any[]>([]);
  const [subStructureData, setSubStructureData] = useState<any[]>([]);
  const [electorDetails, setElectorDetails] = useState<any[]>([]);
  const [globalDisputes, setGlobalDisputes] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isClusteringEnabled, setIsClusteringEnabled] = useState(true);
  const [trafficLightFilter, setTrafficLightFilter] = useState<string | null>(null);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [selectedPadrinoLayers, setSelectedPadrinoLayers] = useState<number[]>([]);
  const [selectedCoordLayers, setSelectedCoordLayers] = useState<number[]>([]);
  const [showLayerSelector, setShowLayerSelector] = useState(false);
  const [expandedLayerPadrinos, setExpandedLayerPadrinos] = useState<number[]>([]);
  const [needsTransportFilter, setNeedsTransportFilter] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleExportReport = async (padrinoId: number) => {
    setIsGeneratingReport(true);
    try {
      const res = await api.get(`/structure/padrinos/${padrinoId}/full-report`);
      setReportData(res.data);
      setTimeout(() => {
        window.print();
        setReportData(null);
      }, 1000);
    } catch (err) {
      console.error("Error generating report:", err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const TacticalReport = () => {
    if (!reportData) return null;
    return (
      <div className="print-only-report">
        <div style={{ padding: '40px', color: '#000', background: '#fff', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <header style={{ borderBottom: '3px solid #0047AB', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', color: '#0047AB', fontWeight: 900 }}>REPORTE TÁCTICO DE CAMPAÑA</h1>
              <p style={{ margin: '5px 0 0', fontSize: '14px', fontWeight: 700, color: '#333' }}>
                DISTRITO: {reportData.padrino.distrito} | FECHA: {new Date(reportData.timestamp).toLocaleDateString('es-PY')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600 }}>INTELEX v2.4</p>
              <p style={{ margin: 0, fontSize: '10px' }}>{new Date(reportData.timestamp).toLocaleTimeString()}</p>
            </div>
          </header>

          <section style={{ marginBottom: '40px' }}>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800 }}>MANDO SUPERIOR</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>NOMBRE</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{reportData.padrino.nombre}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>ASIGNACIÓN</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>LISTA {reportData.padrino.list_number} {reportData.padrino.option_number ? `OPC ${reportData.padrino.option_number}` : ''}</p>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px', color: '#0047AB' }}>RESUMEN DE COORDINADORES</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#0047AB', color: 'white' }}>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>COORDINADOR</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>TOTAL</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>FAVOR</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>DUDOSO</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>CONTRA</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>TRANS.</th>
                </tr>
              </thead>
              <tbody>
                {reportData.coordinators.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 700 }}>{c.nombre}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.total_electors}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.green}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.yellow}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.red}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.transport_needed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div style={{ pageBreakBefore: 'always' }}></div>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '20px', color: '#0047AB', textAlign: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>DETALLE DE ELECTORES POR COORDINADOR</h2>
            {reportData.coordinators.map((c: any) => (
              <div key={c.id} style={{ marginBottom: '30px', breakInside: 'avoid' }}>
                <div style={{ background: '#334155', color: 'white', padding: '8px 15px', borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800 }}>COOR: {c.nombre}</span>
                  <span style={{ fontSize: '12px' }}>{c.electors.length} CAPTURAS</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd' }}>ELECTOR</th>
                      <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd' }}>CÉDULA</th>
                      <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd' }}>LOCAL</th>
                      <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ddd' }}>M/O</th>
                      <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ddd' }}>STATUS</th>
                      <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ddd' }}>TR.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.electors.map((e: any) => (
                      <tr key={e.elector_ci}>
                        <td style={{ padding: '6px', border: '1px solid #ddd', fontWeight: 600 }}>{e.nombre} {e.apellido}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd' }}>{e.elector_ci}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd' }}>{e.local_votacion}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{e.mesa}/{e.orden}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 800, color: TRAFFIC_COLORS[e.traffic_light as keyof typeof TRAFFIC_COLORS] || '#000' }}>{e.traffic_light}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{e.needs_transport ? 'SÍ' : 'NO'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
          <footer style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px dashed #ccc', textAlign: 'center', fontSize: '10px', color: '#666' }}>
            Este documento es de carácter confidencial y estratégico para el operativo electoral.
          </footer>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (activeListId) params.append('listId', activeListId.toString());
      if (selectedLocal) params.append('localId', selectedLocal);
      if (activeDistrict) params.append('district', activeDistrict);

      const [locRes, statRes, capRes, confRes, reqRes, actRes, vehRes, coordRes, structRes] = await Promise.all([
        api.get('/voting-locations'),
        api.get(`/stats/command?${params.toString()}`),
        api.get(`/captures?${params.toString()}`),
        api.get(`/admin/conflicts?${params.toString()}`),
        api.get(`/admin/requests?${params.toString()}`),
        api.get(`/admin/activity?${params.toString()}`),
        api.get(`/vehicles?${params.toString()}`),
        api.get(`/users?${params.toString()}`),
        api.get(`/structure/padrinos?${params.toString()}`)
      ]);
      setLocales(locRes.data);
      setCommandStats(statRes.data);
      setCaptures(capRes.data);
      setConflicts(confRes.data);
      setRequests(reqRes.data);
      setActivities(actRes.data);
      setVehicles(vehRes.data);
      setCoordinators(coordRes.data.filter((u: any) => u.role === 'COORDINADOR'));
      setStructureData(structRes.data);

      if (authUser?.role === 'SUPERUSUARIO' && activeListId === null) {
        const dispRes = await api.get('/admin/disputes/global');
        setGlobalDisputes(dispRes.data);
      } else {
        setGlobalDisputes([]);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [activeListId, activeDistrict, selectedLocal, activeTab]);

  useEffect(() => {
    if (selectedPadrino) {
      api.get(`/structure/padrinos/${selectedPadrino.id}/coordinators`).then(res => setSubStructureData(res.data));
    }
  }, [selectedPadrino]);

  useEffect(() => {
    if (selectedCoordDetails) {
      api.get(`/structure/coordinators/${selectedCoordDetails.id}/electors`).then(res => setElectorDetails(res.data));
    }
  }, [selectedCoordDetails]);

  const handleResolveRequest = async (requestId: number, status: string) => {
    try {
      await api.post(`/admin/requests/${requestId}/resolve`, {
        status,
        resolved_by_id: authUser?.id
      });
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleResolve = async (winnerCaptureId: number) => {
    try {
      await api.post('/admin/conflicts/resolve', {
        conflict_id: showResolveModal.conflict_id,
        winner_capture_id: winnerCaptureId
      });
      setShowResolveModal(null);
      loadData();
    } catch (err) { console.error(err); }
  };


  const handleLocalClick = (localId: string) => {
    setSelectedLocal(localId);
  };

  const clearLocalFilter = () => {
    setSelectedLocal(null);
  };

  useEffect(() => {
    if (!loading && !authUser) navigate('/login');
  }, [authUser, loading, navigate]);

  if (loading) return null;

  return (
    <MainLayout 
      title="Comando Central" 
      userName={authUser?.nombre || "Director"} 
      userPhoto={authUser?.photo_url}
    >
      <div style={{ 
        padding: isMobile ? '1.5rem 1rem 1rem' : '1.5rem 2rem',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'center' : 'center',
        justifyContent: isMobile ? 'center' : 'flex-start',
        gap: isMobile ? '1rem' : '1.25rem',
        textAlign: isMobile ? 'center' : 'left'
      }}>
        <div style={{ 
          width: isMobile ? '42px' : '52px', 
          height: isMobile ? '42px' : '52px', 
          borderRadius: '16px', 
          background: 'linear-gradient(135deg, var(--plra-600), var(--plra-400))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white',
          boxShadow: '0 8px 20px rgba(37,99,235,0.25)',
          flexShrink: 0
        }}>
          <Target size={isMobile ? 22 : 28} />
        </div>
        <div>
          <h1 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.75rem', 
            fontWeight: 900, 
            letterSpacing: '-0.02em', 
            color: 'var(--text)',
            lineHeight: 1.1
          }}>
            Centro de Decisiones <span style={{ color: 'var(--plra-300)' }}>Estratégicas</span>
          </h1>
          <p style={{ 
            fontSize: isMobile ? '0.6rem' : '0.85rem', 
            color: 'var(--text-3)', 
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: '0.25rem'
          }}>Monitoreo Táctico en Tiempo Real</p>
        </div>
      </div>

      <div style={{ padding: '0 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0', alignItems: 'center', background: 'rgba(255,255,255,0.01)', overflowX: 'auto' }}>
        {([
          { id: 'map',       icon: MapPin,  label: 'Mapa Táctico',    badge: null },
          { id: 'hierarchy', icon: Shield,  label: 'Jerarquía',       badge: null },
          { id: 'requests',  icon: Bell,    label: 'Solicitudes',     badge: requests.filter(r => r.status === 'PENDING').length || null },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer',
              padding: '0.85rem 1.25rem',
              color: activeTab === tab.id ? 'var(--plra-300)' : 'var(--text-3)',
              background: 'none', border: 'none', 
              borderBottom: activeTab === tab.id ? '2px solid var(--plra-300)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 800 : 600,
              fontSize: '0.82rem', whiteSpace: 'nowrap', transition: 'color 0.15s',
              fontFamily: 'var(--font-display)'
            }}
          >
            <tab.icon size={15} strokeWidth={activeTab === tab.id ? 2.2 : 1.6} />
            {tab.label}
            {tab.badge ? (
              <span style={{ background: 'var(--red)', color: 'white', fontSize: '0.58rem', fontWeight: 900, padding: '1px 6px', borderRadius: '999px', lineHeight: '1.4' }}>
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : (showSidebar ? '320px 1fr' : '0px 1fr'), 
        height: isMobile ? 'calc(100vh - 110px)' : 'calc(100vh - 110px)', 
        overflow: 'hidden',
        position: 'relative',
        transition: 'grid-template-columns 0.3s ease'
      }}>
        {/* Toggle Sidebar Button for Mobile/Tablet - ONLY ON MAP */}
        {(isMobile || !showSidebar) && activeTab === 'map' && (
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            style={{
              position: 'absolute', top: '1rem', left: '1rem', zIndex: 1100,
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--plra-300)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', cursor: 'pointer'
            }}
          >
            {showSidebar ? <X size={20} /> : <BarChart3 size={20} />}
          </button>
        )}

        <aside style={{ 
          overflowY: 'auto', 
          overflowX: 'hidden',
          background: isDark ? 'rgba(10, 20, 40, 0.6)' : 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border)',
          position: isMobile ? 'absolute' : 'relative',
          left: isMobile && !showSidebar ? '-300px' : '0',
          top: 0, bottom: 0,
          width: isMobile ? '260px' : 'auto',
          zIndex: 1050,
          transition: 'left 0.3s ease',
          boxShadow: isMobile && showSidebar ? '20px 0 50px rgba(0,0,0,0.5)' : 'none'
        }}>
          <SidebarContent 
            stats={commandStats} 
            activities={activities} 
            conflicts={conflicts} 
            onResolve={setShowResolveModal} 
            settings={settings} 
            isReadOnly={authUser?.role === 'COORDINADOR'} 
            onFilter={setTrafficLightFilter}
            currentFilter={trafficLightFilter}
          />
        </aside>
        <div style={{ position: 'relative', minWidth: 0, minHeight: 0, background: 'var(--surface-light)' }}>
          {activeTab === 'map' ? (
            <div style={{ height: '100%', position: 'relative' }}>
              <div style={{ 
                position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000, 
                display: 'flex', flexDirection: 'column', gap: '0.5rem' 
              }}>
                <button 
                  onClick={() => setShowVehicles(!showVehicles)}
                  style={{ 
                    padding: '0.6rem 1rem', borderRadius: '10px', 
                    background: showVehicles ? 'var(--plra-300)' : 'var(--surface)', 
                    color: showVehicles ? 'white' : 'var(--text-3)',
                    border: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                >
                  <Radio size={14} /> Logística: {showVehicles ? 'ON' : 'OFF'}
                </button>

                <button 
                  onClick={() => setIsClusteringEnabled(!isClusteringEnabled)}
                  style={{ 
                    padding: '0.6rem 1rem', borderRadius: '10px', 
                    background: isClusteringEnabled ? 'var(--plra-300)' : 'rgba(255,255,255,0.05)', 
                    color: 'white',
                    border: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <Target size={14} /> Agrupar: {isClusteringEnabled ? 'SI' : 'NO'}
                </button>
                
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowLayerSelector(!showLayerSelector)}
                    style={{
                      padding: '0.6rem 1rem', borderRadius: '10px',
                      background: (selectedPadrinoLayers.length > 0 || selectedCoordLayers.length > 0) ? 'var(--plra-400)' : 'rgba(255,255,255,0.07)',
                      color: 'white', border: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 800,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', width: '100%'
                    }}
                  >
                    <Users size={14} />
                    Capas: {selectedPadrinoLayers.length === 0 && selectedCoordLayers.length === 0 ? 'Global' : `${selectedPadrinoLayers.length}P ${selectedCoordLayers.length}C`}
                  </button>
                  {showLayerSelector && (
                    <div style={{
                      position: 'absolute', top: 0, right: 'calc(100% + 8px)', width: '240px', maxHeight: '340px',
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.6)', zIndex: 2000, overflowY: 'auto', padding: '0.6rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.4rem 0.6rem', borderBottom: '1px solid var(--border)', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capas por Padrino</span>
                        <button onClick={() => { setSelectedPadrinoLayers([]); setSelectedCoordLayers([]); }} style={{ fontSize: '0.55rem', color: 'var(--plra-300)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Limpiar</button>
                      </div>
                      {structureData.map((p: any) => {
                        const pCoords = coordinators.filter(c => c.parent_id === p.id);
                        const pSelected = selectedPadrinoLayers.includes(p.id);
                        const expanded = expandedLayerPadrinos.includes(p.id);
                        return (
                          <div key={p.id} style={{ marginBottom: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.5rem', borderRadius: '8px', cursor: 'pointer', background: pSelected ? 'rgba(59,130,246,0.12)' : 'transparent' }}>
                              <div
                                onClick={() => setSelectedPadrinoLayers(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                style={{ width: '13px', height: '13px', borderRadius: '4px', border: `1.5px solid ${pSelected ? 'var(--plra-300)' : 'var(--border)'}`, background: pSelected ? 'var(--plra-300)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >
                                {pSelected && <div style={{ width: '6px', height: '6px', background: 'white', borderRadius: '1px' }} />}
                              </div>
                              <span onClick={() => setSelectedPadrinoLayers(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} style={{ fontSize: '0.72rem', fontWeight: 700, color: pSelected ? 'var(--text)' : 'var(--text-2)', flex: 1 }}>{p.nombre}</span>
                              {pCoords.length > 0 && (
                                <button onClick={() => setExpandedLayerPadrinos(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '0', display: 'flex' }}>
                                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                              )}
                            </div>
                            {expanded && pCoords.map(c => {
                              const cSelected = selectedCoordLayers.includes(c.id);
                              return (
                                <div key={c.id} onClick={() => setSelectedCoordLayers(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem 0.35rem 1.6rem', borderRadius: '6px', cursor: 'pointer', background: cSelected ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                                  <div style={{ width: '11px', height: '11px', borderRadius: '3px', border: `1.5px solid ${cSelected ? 'var(--plra-300)' : 'var(--border)'}`, background: cSelected ? 'var(--plra-300)' : 'transparent', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.67rem', color: cSelected ? 'var(--text)' : 'var(--text-3)', fontWeight: 600 }}>{c.nombre}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedLocal && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ 
                      padding: '0.6rem 1rem', borderRadius: '10px', 
                      background: 'var(--accent-subtle)', 
                      color: 'var(--plra-200)',
                      border: '1px solid var(--plra-300)', fontSize: '0.7rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      backdropFilter: 'blur(8px)'
                    }}
                  >
                    <MapPin size={14} /> FILTRO: {locales.find(l => l.cod_local === selectedLocal)?.nombre}
                    <button 
                      onClick={clearLocalFilter}
                      style={{ background: 'var(--plra-500)', border: 'none', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 800 }}
                    >
                      LIMPIAR
                    </button>
                  </motion.div>
                )}
              </div>

              <MapContainer center={[-22.5422, -55.7336]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <ZoomControl position="bottomright" />
                <MapHandler 
                  center={selectedLocal ? (locales.find(l => l.cod_local === selectedLocal) ? [locales.find(l => l.cod_local === selectedLocal).lat, locales.find(l => l.cod_local === selectedLocal).lng] : null) : null} 
                  selectedLocalId={selectedLocal}
                />

                {locales.map((l: any) => {
                  const locStat = commandStats?.locations?.find((s: any) => s.cod_local === l.cod_local);
                  const color = locStat?.percentage > 70 ? 'var(--green)' : locStat?.percentage > 30 ? 'var(--yellow)' : 'var(--red)';
                  const isSelected = selectedLocal === l.cod_local;
                  
                  return (
                    <Marker 
                      key={l.cod_local} 
                      position={[l.lat, l.lng]} 
                      icon={createCustomIcon(isSelected ? 'white' : color, l.icon, isSelected)}
                      eventHandlers={{
                        click: () => handleLocalClick(l.cod_local)
                      }}
                    >
                      <Popup>
                        <div style={{ padding: '0.5rem' }}>
                          <p style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{l.nombre}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Progreso: <strong>{locStat?.percentage || 0}%</strong></p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{locStat?.total_captures || 0} / {locStat?.total_electors || 0} captados</p>
                          <button 
                            onClick={() => handleLocalClick(l.cod_local)}
                            style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem', borderRadius: '4px', background: 'var(--plra-500)', color: 'white', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Filtrar este local
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
                {isClusteringEnabled ? (
                  <MarkerClusterGroup disableClusteringAtZoom={15} maxClusterRadius={40}>
                    {captures
                      .filter(cap => !selectedLocal || cap.local_votacion === locales.find(l => l.cod_local === selectedLocal)?.nombre)
                      .filter(cap => !trafficLightFilter || cap.traffic_light === trafficLightFilter)
                      .filter(cap => !needsTransportFilter || cap.needs_transport === 1)
                      .filter(cap => {
                        if (selectedPadrinoLayers.length === 0 && selectedCoordLayers.length === 0) return true;
                        const coord = coordinators.find((c: any) => c.id === cap.coordinator_id);
                        if (selectedCoordLayers.includes(cap.coordinator_id)) return true;
                        if (coord?.parent_id && selectedPadrinoLayers.includes(coord.parent_id)) return true;
                        return false;
                      })
                      .map((cap, idx) => {
                      const jitter = 0.00003 * Math.sqrt(idx);
                      const angle = idx * 137.5;
                      const lat = cap.lat + (Math.cos(angle * (Math.PI / 180)) * jitter);
                      const lng = cap.lng + (Math.sin(angle * (Math.PI / 180)) * jitter);
                      
                      return (
                        <Marker 
                          key={`cap-${cap.id}`} 
                          position={[lat, lng]} 
                          icon={createCustomIcon(
                            cap.traffic_light === 'GREEN' ? 'var(--green)' : 
                            cap.traffic_light === 'YELLOW' ? 'var(--yellow)' : 
                            cap.traffic_light === 'PURPLE' ? '#A855F7' : 'var(--red)', 
                            'MapPin', 
                            cap.needs_transport === 1
                          )}
                        >
                          <Popup className="premium-popup">
                            <div style={{ minWidth: '230px', maxWidth: '265px' }}>
                              {/* Header */}
                              <div style={{ padding: '0.75rem 0.9rem 0.55rem', background: 'linear-gradient(135deg,#081526,#0d1f3c)', borderBottom: '1px solid rgba(59,130,246,0.18)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.35rem' }}>
                                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
                                    background: cap.traffic_light === 'GREEN' ? '#22C55E' : cap.traffic_light === 'YELLOW' ? '#EAB308' : cap.traffic_light === 'PURPLE' ? '#A855F7' : '#EF4444',
                                    boxShadow: `0 0 8px ${cap.traffic_light === 'GREEN' ? '#22C55E80' : cap.traffic_light === 'YELLOW' ? '#EAB30880' : cap.traffic_light === 'PURPLE' ? '#A855F780' : '#EF444480'}`
                                  }} />
                                  <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.15, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    {cap.nombre} {cap.apellido}
                                  </p>
                                </div>
                                <span style={{ fontSize: '0.55rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px', background: '#0047AB', color: 'white', letterSpacing: '0.06em', marginLeft: '1.5rem' }}>
                                  L-{cap.list_number}
                                </span>
                              </div>
                              {/* Body */}
                              <div style={{ padding: '0.6rem 0.9rem 0.75rem', background: '#0a1525' }}>
                                {/* Coordinator */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#3B82F6', flexShrink: 0 }}>
                                    {cap.coordinator_name?.charAt(0) || '?'}
                                  </div>
                                  <div>
                                    <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>CAPTADO POR</p>
                                    <p style={{ fontSize: '0.72rem', color: 'white', margin: 0, fontWeight: 800 }}>{cap.coordinator_name}</p>
                                  </div>
                                </div>
                                {/* Padrino */}
                                {(cap.padrino_name || cap.parent_name) && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#A855F7', flexShrink: 0 }}>
                                      {(cap.padrino_name || cap.parent_name)?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                      <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>SUPERIOR</p>
                                      <p style={{ fontSize: '0.72rem', color: '#A855F7', margin: 0, fontWeight: 800 }}>{cap.padrino_name || cap.parent_name}</p>
                                    </div>
                                  </div>
                                )}
                                {/* Local */}
                                <div style={{ padding: '0.4rem 0.55rem', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '0.15rem' }}>
                                  <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.3 }}>{cap.local_votacion}</p>
                                  {cap.needs_transport === 1 && (
                                    <span style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.52rem', color: '#93C5FD', fontWeight: 900, background: 'rgba(59,130,246,0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                                      🚌 REQUIERE TRANSPORTE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MarkerClusterGroup>
                ) : (
                  captures
                    .filter(cap => !selectedLocal || cap.local_votacion === locales.find(l => l.cod_local === selectedLocal)?.nombre)
                    .filter(cap => !trafficLightFilter || cap.traffic_light === trafficLightFilter)
                    .filter(cap => !needsTransportFilter || cap.needs_transport === 1)
                    .filter(cap => {
                      if (selectedPadrinoLayers.length === 0 && selectedCoordLayers.length === 0) return true;
                      const coord = coordinators.find((c: any) => c.id === cap.coordinator_id);
                      if (selectedCoordLayers.includes(cap.coordinator_id)) return true;
                      if (coord?.parent_id && selectedPadrinoLayers.includes(coord.parent_id)) return true;
                      return false;
                    })
                    .map((cap, idx) => {
                    const jitter = 0.00003 * Math.sqrt(idx);
                    const angle = idx * 137.5;
                    const lat = cap.lat + (Math.cos(angle * (Math.PI / 180)) * jitter);
                    const lng = cap.lng + (Math.sin(angle * (Math.PI / 180)) * jitter);
                    
                    return (
                      <Marker 
                        key={`cap-raw-${cap.id}`} 
                        position={[lat, lng]} 
                        icon={createCustomIcon(
                          cap.traffic_light === 'GREEN' ? 'var(--green)' : 
                          cap.traffic_light === 'YELLOW' ? 'var(--yellow)' : 
                          cap.traffic_light === 'PURPLE' ? '#A855F7' : 'var(--red)', 
                          'MapPin', 
                          cap.needs_transport === 1
                        )}
                      >
                        <Popup className="premium-popup">
                          <div style={{ minWidth: '230px', maxWidth: '265px' }}>
                            <div style={{ padding: '0.75rem 0.9rem 0.55rem', background: 'linear-gradient(135deg,#081526,#0d1f3c)', borderBottom: '1px solid rgba(59,130,246,0.18)' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.35rem' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
                                  background: cap.traffic_light === 'GREEN' ? '#22C55E' : cap.traffic_light === 'YELLOW' ? '#EAB308' : cap.traffic_light === 'PURPLE' ? '#A855F7' : '#EF4444',
                                  boxShadow: `0 0 8px ${cap.traffic_light === 'GREEN' ? '#22C55E80' : cap.traffic_light === 'YELLOW' ? '#EAB30880' : cap.traffic_light === 'PURPLE' ? '#A855F780' : '#EF444480'}`
                                }} />
                                <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.15, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                  {cap.nombre} {cap.apellido}
                                </p>
                              </div>
                              <span style={{ fontSize: '0.55rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px', background: '#0047AB', color: 'white', letterSpacing: '0.06em', marginLeft: '1.5rem' }}>
                                L-{cap.list_number}
                              </span>
                            </div>
                            <div style={{ padding: '0.6rem 0.9rem 0.75rem', background: '#0a1525' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#3B82F6', flexShrink: 0 }}>
                                  {cap.coordinator_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>CAPTADO POR</p>
                                  <p style={{ fontSize: '0.72rem', color: 'white', margin: 0, fontWeight: 800 }}>{cap.coordinator_name}</p>
                                </div>
                              </div>
                              {(cap.padrino_name || cap.parent_name) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#A855F7', flexShrink: 0 }}>
                                    {(cap.padrino_name || cap.parent_name)?.charAt(0) || '?'}
                                  </div>
                                  <div>
                                    <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>SUPERIOR</p>
                                    <p style={{ fontSize: '0.72rem', color: '#A855F7', margin: 0, fontWeight: 800 }}>{cap.padrino_name || cap.parent_name}</p>
                                  </div>
                                </div>
                              )}
                              <div style={{ padding: '0.4rem 0.55rem', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '0.15rem' }}>
                                <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.3 }}>{cap.local_votacion}</p>
                                {cap.needs_transport === 1 && (
                                  <span style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.52rem', color: '#93C5FD', fontWeight: 900, background: 'rgba(59,130,246,0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                                    🚌 REQUIERE TRANSPORTE
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })
                )}
                {showVehicles && vehicles.map((v) => (
                  <Marker key={`veh-${v.id}`} position={[v.lat, v.lng]} icon={createCustomIcon('var(--plra-300)', 'Car')}>
                    <Popup>
                      <div style={{ padding: '0.5rem' }}>
                        <p style={{ fontWeight: 800, fontSize: '0.8rem' }}>Vehículo: {v.id}</p>
                        <p style={{ fontSize: '0.7rem' }}>Capacidad: {v.capacity} personas</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--green)' }}>Estado: {v.status}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Mobile Quick Stats Bar */}
                {isMobile && !showSidebar && (
                  <div style={{
                    position: 'absolute', bottom: '1.5rem', left: '1rem', right: '1rem', zIndex: 1100,
                    background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(12px)',
                    border: '1px solid var(--border)', borderRadius: '16px', padding: '0.75rem 1rem',
                    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                  }}>
                    <div 
                      onClick={() => setTrafficLightFilter(trafficLightFilter === 'GREEN' ? null : 'GREEN')}
                      style={{ textAlign: 'center', cursor: 'pointer', opacity: !trafficLightFilter || trafficLightFilter === 'GREEN' ? 1 : 0.4 }}
                    >
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>A Favor</p>
                      <p style={{ fontSize: '1.1rem', color: 'var(--green)', fontWeight: 900 }}>{commandStats?.green || 0}</p>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Progreso</p>
                      <p style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900 }}>{commandStats?.percentage || 0}%</p>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                    <div 
                      onClick={() => setTrafficLightFilter(trafficLightFilter === 'RED' ? null : 'RED')}
                      style={{ textAlign: 'center', cursor: 'pointer', opacity: !trafficLightFilter || trafficLightFilter === 'RED' ? 1 : 0.4 }}
                    >
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>En Contra</p>
                      <p style={{ fontSize: '1.1rem', color: 'var(--red)', fontWeight: 900 }}>{conflicts.length > 0 ? conflicts.length : (commandStats?.red || 0)}</p>
                    </div>
                  </div>
                )}

                {/* Map Legend */}
                <div style={{
                  position: 'absolute', bottom: isMobile ? '7rem' : '2rem', left: '1rem', zIndex: 1000,
                  background: 'rgba(8, 14, 26, 0.92)', backdropFilter: 'blur(16px)',
                  padding: '0.85rem 0.9rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  minWidth: '150px'
                }}>
                  <div style={{ fontSize: '0.52rem', fontWeight: 900, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Estado del elector</div>
                  {[
                    { id: 'GREEN',  label: 'A FAVOR',    color: '#22C55E' },
                    { id: 'YELLOW', label: 'DUDOSO',     color: '#EAB308' },
                    { id: 'RED',    label: 'EN CONTRA',  color: '#EF4444' },
                    { id: 'PURPLE', label: 'NO DEFINIDO',color: '#A855F7' },
                  ].map(item => {
                    const active = trafficLightFilter === item.id;
                    const dimmed = !!trafficLightFilter && !active;
                    return (
                      <div key={item.id} onClick={() => setTrafficLightFilter(active ? null : item.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer',
                          opacity: dimmed ? 0.28 : 1, transition: 'opacity 0.2s, background 0.15s',
                          background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                          padding: '0.28rem 0.5rem', borderRadius: '7px', margin: '0 -0.3rem'
                        }}
                      >
                        <div style={{
                          width: '13px', height: '13px', borderRadius: '50%', flexShrink: 0,
                          background: item.color,
                          boxShadow: active ? `0 0 8px ${item.color}` : 'none',
                          border: active ? `2px solid rgba(255,255,255,0.6)` : '2px solid transparent'
                        }} />
                        <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.9)', fontWeight: active ? 900 : 700 }}>{item.label}</span>
                        {active && <div style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: item.color }} />}
                      </div>
                    );
                  })}

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.5rem', marginTop: '0.15rem' }}>
                    <div
                      onClick={() => setNeedsTransportFilter(!needsTransportFilter)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer',
                        background: needsTransportFilter ? 'rgba(59,130,246,0.15)' : 'transparent',
                        padding: '0.28rem 0.5rem', borderRadius: '7px', margin: '0 -0.3rem',
                        border: needsTransportFilter ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ width: '13px', height: '13px', borderRadius: '50%', flexShrink: 0, border: `2.5px solid #3B82F6`, background: needsTransportFilter ? '#3B82F650' : 'transparent' }} />
                      <span style={{ fontSize: '0.62rem', color: needsTransportFilter ? '#93C5FD' : 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
                        {needsTransportFilter ? '✓ ' : ''}TRANSPORTE
                      </span>
                    </div>
                  </div>

                  {(trafficLightFilter || needsTransportFilter) && (
                    <button onClick={() => { setTrafficLightFilter(null); setNeedsTransportFilter(false); }}
                      style={{ marginTop: '0.15rem', padding: '0.3rem', borderRadius: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '0.55rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em' }}>
                      LIMPIAR FILTROS
                    </button>
                  )}
                </div>
              </MapContainer>
            </div>
          ) : activeTab === 'hierarchy' ? (
            <div className="hierarchy-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.25rem' }}>Estructura de <span style={{ color: 'var(--plra-300)' }}>Mando</span></h2>
                    <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', fontWeight: 700 }}>JERARQUÍA OPERATIVA DE CAMPAÑA</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {selectedPadrino && !selectedCoordDetails && (
                      <button 
                        disabled={isGeneratingReport}
                        onClick={() => handleExportReport(selectedPadrino.id)}
                        style={{ 
                          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', 
                          color: 'var(--plra-300)', padding: '0.6rem 1rem', borderRadius: '12px', 
                          cursor: 'pointer', fontWeight: 800, fontSize: '0.7rem',
                          display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                      >
                        <Download size={14} /> {isGeneratingReport ? 'GENERANDO...' : 'REPORTE PDF'}
                      </button>
                    )}
                    {(selectedPadrino || selectedCoordDetails) && (
                      <button 
                        onClick={() => {
                          if (selectedCoordDetails) setSelectedCoordDetails(null);
                          else setSelectedPadrino(null);
                        }}
                        style={{ background: 'var(--plra-600)', border: 'none', color: 'white', padding: '0.6rem 1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '0.7rem' }}
                      >
                        ← VOLVER
                      </button>
                    )}
                  </div>
                </header>

                {structureData.length === 0 ? (
                  <div className="empty-state-card">
                    <div className="icon-pulse"><Users size={48} /></div>
                    <h3>Jerarquía de Mando Vacía</h3>
                    <p>No se han encontrado Padrinos registrados en el distrito seleccionado.</p>
                  </div>
                ) : !selectedPadrino ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {structureData.map(p => (
                      <motion.div 
                        whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}
                        key={p.id}
                        onClick={() => setSelectedPadrino(p)}
                        style={{ 
                          background: 'var(--surface)', border: '1px solid var(--border)', 
                          borderRadius: '18px', padding: '1.25rem', cursor: 'pointer', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                          {p.photo_url ? (
                            <img src={p.photo_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', border: '2px solid var(--plra-500)' }} />
                          ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--plra-600), var(--plra-400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{p.nombre?.charAt(0)}</div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</p>
                            <span style={{ fontSize: '0.55rem', color: 'var(--plra-300)', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              PADRINO LISTA {p.list_number || '3'} {p.option_number ? `OPC ${p.option_number}` : ''}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.5rem' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.5rem', color: 'var(--text-3)', fontWeight: 800, margin: '0 0 2px' }}>COORDS</p>
                            <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{p.coordinator_count}</p>
                          </div>
                          <div style={{ background: 'rgba(59,130,246,0.05)', padding: '0.6rem', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.1)', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.5rem', color: 'var(--plra-300)', fontWeight: 800, margin: '0 0 2px' }}>CAPTURAS</p>
                            <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{p.total_electors || 0}</p>
                          </div>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '1rem', display: 'flex', overflow: 'hidden' }}>
                          {p.total_electors > 0 && (
                            <>
                              <div style={{ width: `${(p.green_total/p.total_electors)*100}%`, background: 'var(--green)' }} />
                              <div style={{ width: `${(p.yellow_total/p.total_electors)*100}%`, background: 'var(--yellow)' }} />
                              <div style={{ width: `${(p.red_total/p.total_electors)*100}%`, background: 'var(--red)' }} />
                              <div style={{ width: `${(p.purple_total/p.total_electors)*100}%`, background: '#A855F7' }} />
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : !selectedCoordDetails ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                    {subStructureData.map(c => (
                      <motion.div 
                        whileHover={{ y: -3 }}
                        key={c.id}
                        onClick={() => setSelectedCoordDetails(c)}
                        style={{ 
                          background: 'var(--surface)', border: '1px solid var(--border)', 
                          borderRadius: '20px', padding: '1.25rem', cursor: 'pointer', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                          {c.photo_url ? (
                            <img src={c.photo_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 900, color: 'var(--plra-300)' }}>{c.nombre?.charAt(0)}</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.9rem', fontWeight: 900, color: 'white', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</p>
                            <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', margin: 0, fontWeight: 700 }}>{c.total_electors || 0} CAPTURAS TOTALES</p>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '1rem' }}>
                          <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.15)' }}>
                            <p style={{ fontSize: '0.45rem', color: 'var(--green)', fontWeight: 900, margin: '0 0 2px' }}>FAVOR</p>
                            <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', margin: 0 }}>{c.green || 0}</p>
                          </div>
                          <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(234,179,8,0.08)', borderRadius: '10px', border: '1px solid rgba(234,179,8,0.15)' }}>
                            <p style={{ fontSize: '0.45rem', color: 'var(--yellow)', fontWeight: 900, margin: '0 0 2px' }}>DUDOSO</p>
                            <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{c.yellow || 0}</p>
                          </div>
                          <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                            <p style={{ fontSize: '0.45rem', color: 'var(--red)', fontWeight: 900, margin: '0 0 2px' }}>CONTRA</p>
                            <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{c.red || 0}</p>
                          </div>
                          <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(168,85,247,0.08)', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.15)' }}>
                            <p style={{ fontSize: '0.45rem', color: '#A855F7', fontWeight: 900, margin: '0 0 2px' }}>PURPURA</p>
                            <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{c.purple || 0}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.08)', padding: '0.5rem 0.75rem', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Truck size={14} color="var(--plra-300)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--plra-200)' }}>TRANSPORTE</span>
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'white' }}>{c.transport_needed || 0}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '28px', overflow: 'hidden' }}>
                    <div style={{ padding: '1.75rem', background: 'rgba(59,130,246,0.1)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--plra-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900, color: 'white' }}>{selectedCoordDetails.nombre.charAt(0)}</div>
                        <div>
                          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', margin: 0 }}>{selectedCoordDetails.nombre}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0 }}>{electorDetails.length} electores bajo gestión operativa</p>
                        </div>
                      </div>
                      <a href={`https://wa.me/${selectedCoordDetails.telefono?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ background: '#22C55E', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '14px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <MessageSquare size={18} /> CONTACTAR
                      </a>
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1.25rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Elector</th>
                            <th style={{ padding: '1.25rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Cédula</th>
                            <th style={{ padding: '1.25rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Local / Mesa</th>
                            <th style={{ padding: '1.25rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Fidelidad</th>
                            <th style={{ padding: '1.25rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {electorDetails.map(e => (
                            <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '1.25rem' }}>
                                <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', margin: 0 }}>{e.nombre} {e.apellido}</p>
                                {e.needs_transport === 1 && <span style={{ fontSize: '0.55rem', color: 'var(--plra-300)', fontWeight: 900 }}>REQUIERE TRANSPORTE</span>}
                              </td>
                              <td style={{ padding: '1.25rem', fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 700 }}>{e.elector_ci}</td>
                              <td style={{ padding: '1.25rem' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', margin: 0, fontWeight: 700 }}>{e.local_votacion}</p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>Mesa {e.mesa} — Orden {e.orden}</p>
                              </td>
                              <td style={{ padding: '1.25rem' }}>
                                <div style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem', 
                                  background: e.traffic_light === 'GREEN' ? 'rgba(34,197,94,0.1)' : e.traffic_light === 'YELLOW' ? 'rgba(234,179,8,0.1)' : e.traffic_light === 'PURPLE' ? 'rgba(168,85,247,0.1)' : 'rgba(239,68,68,0.1)', 
                                  padding: '4px 10px', borderRadius: '8px' 
                                }}>
                                  <div style={{ 
                                    width: '8px', height: '8px', borderRadius: '50%', 
                                    background: e.traffic_light === 'GREEN' ? 'var(--green)' : e.traffic_light === 'YELLOW' ? 'var(--yellow)' : e.traffic_light === 'PURPLE' ? '#A855F7' : 'var(--red)' 
                                  }} />
                                  <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'white' }}>{e.traffic_light}</span>
                                </div>
                              </td>
                              <td style={{ padding: '1.25rem' }}>
                                <button onClick={() => window.open(`https://wa.me/${e.telefono?.replace(/\D/g, '')}`, '_blank')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer' }}>
                                  <MessageSquare size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Solicitudes tab ── */
            <div style={{ padding: 'clamp(1rem, 3vw, 2rem)', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.3rem' }}>
                      Solicitudes <span style={{ color: 'var(--plra-300)' }}>de Campo</span>
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Conflictos, incidentes y requerimientos reportados por coordinadores.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {requests.filter(r => r.status === 'PENDING').length > 0 && (
                      <div style={{ padding: '0.4rem 0.9rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: 'var(--red)', fontSize: '0.72rem', fontWeight: 900 }}>
                        {requests.filter(r => r.status === 'PENDING').length} PENDIENTES
                      </div>
                    )}
                    <div style={{ padding: '0.4rem 0.9rem', background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--plra-300)', fontSize: '0.72rem', fontWeight: 800 }}>
                      {requests.length} TOTAL
                    </div>
                  </div>
                </div>

                {requests.length === 0 ? (
                  <div className="empty-state-card">
                    <div className="icon-pulse"><Bell size={48} /></div>
                    <h3>Sin Solicitudes Activas</h3>
                    <p>No hay incidentes ni solicitudes de campo reportadas en este momento.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem' }}>
                    {requests
                      .sort((a: any, b: any) => {
                        const order = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };
                        const pa = order[a.priority as keyof typeof order] ?? 3;
                        const pb = order[b.priority as keyof typeof order] ?? 3;
                        if (pa !== pb) return pa - pb;
                        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                      })
                      .map((req: any) => (
                        <RequestItem
                          key={req.id}
                          req={req}
                          onResolve={(status) => handleResolveRequest(req.id, status)}
                          isReadOnly={authUser?.role === 'PADRINO'}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showResolveModal && (
            <div className="modal-overlay" onClick={() => setShowResolveModal(null)}>
              <motion.div 
                className="modal-content"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '500px', width: '100%' }}
              >
                <div style={{ padding: '2rem', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to bottom, rgba(239,68,68,0.05), transparent)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertTriangle size={24} style={{ color: 'var(--red)' }} />
                    Conflicto de Captura
                  </h3>
                </div>
                
                <div style={{ padding: '2rem' }}>
                  <p style={{ color: 'var(--text-2)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.9rem' }}>
                    Se ha detectado una disputa por <strong>{showResolveModal.elector_nombre} {showResolveModal.elector_apellido}</strong>. 
                    Compara los detalles para decidir a quién adjudicar el elector:
                  </p>
                  
                    {/* Party 1: Original */}
                    <div style={{ 
                      padding: '1.25rem', borderRadius: '16px', background: 'var(--accent-subtle)', 
                      border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' 
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, padding: '2px 8px', background: 'var(--plra-500)', color: 'white', fontSize: '0.55rem', fontWeight: 800, borderRadius: '0 0 8px 0', zIndex: 10 }}>CAPTURA ORIGINAL</div>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.2rem' }}>{showResolveModal.original_coordinator_name}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, marginBottom: '0.75rem' }}>Superior: <span style={{ color: 'var(--plra-300)' }}>{showResolveModal.original_parent_name || 'Mando Directo'}</span></p>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.65rem', color: 'var(--text-3)', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.6rem', borderRadius: '8px' }}>
                            <Clock size={12} />
                            {new Date(showResolveModal.original_capture_time).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* Mini Map Thumbnail */}
                        <div style={{ width: '100px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <MapContainer 
                            center={[showResolveModal.original_capture_lat, showResolveModal.original_capture_lng]} 
                            zoom={15} 
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            dragging={false}
                            scrollWheelZoom={false}
                            doubleClickZoom={false}
                            attributionControl={false}
                          >
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                            <Marker position={[showResolveModal.original_capture_lat, showResolveModal.original_capture_lng]} icon={createCustomIcon('var(--plra-500)', 'MapPin')} />
                          </MapContainer>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleResolve(showResolveModal.original_capture_id)}
                        className="btn-confirm-styled" 
                        style={{ width: '100%', marginTop: '1rem', padding: '0.6rem', fontSize: '0.7rem', background: 'var(--plra-600)' }}
                      >
                        ADJUDICAR A ORIGINAL
                      </button>
                    </div>

                    {/* Party 2: New Conflict */}
                    <div style={{ 
                      padding: '1.25rem', borderRadius: '16px', background: 'rgba(239,68,68,0.05)', 
                      border: '1px solid rgba(239,68,68,0.2)', position: 'relative', overflow: 'hidden' 
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, padding: '2px 8px', background: 'var(--red)', color: 'white', fontSize: '0.55rem', fontWeight: 800, borderRadius: '0 0 8px 0', zIndex: 10 }}>NUEVA DISPUTA</div>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.2rem' }}>{showResolveModal.coordinator_name}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, marginBottom: '0.75rem' }}>Superior: <span style={{ color: 'var(--plra-300)' }}>{showResolveModal.parent_name || 'Mando Directo'}</span></p>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.65rem', color: 'var(--text-3)', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.6rem', borderRadius: '8px' }}>
                            <Clock size={12} />
                            {new Date(showResolveModal.capture_time).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* Mini Map Thumbnail */}
                        <div style={{ width: '100px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <MapContainer 
                            center={[showResolveModal.capture_lat, showResolveModal.capture_lng]} 
                            zoom={15} 
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            dragging={false}
                            scrollWheelZoom={false}
                            doubleClickZoom={false}
                            attributionControl={false}
                          >
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                            <Marker position={[showResolveModal.capture_lat, showResolveModal.capture_lng]} icon={createCustomIcon('var(--red)', 'MapPin')} />
                          </MapContainer>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleResolve(showResolveModal.capture_id)}
                        className="btn-confirm-styled" 
                        style={{ width: '100%', marginTop: '1rem', padding: '0.6rem', fontSize: '0.7rem', background: 'var(--red)' }}
                      >
                        ADJUDICAR A NUEVO
                      </button>
                    </div>
                  </div>

                <div className="modal-footer-premium-styled">
                  <button onClick={() => setShowResolveModal(null)} className="btn-cancel-styled" style={{ width: '100%' }}>Cerrar sin cambios</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <TacticalReport />
        <style>
          {`
            @media print {
              /* Hide everything by default */
              body * { 
                visibility: hidden !important; 
                height: 0 !important;
                overflow: hidden !important;
              }
              
              /* Show only the report */
              .print-only-report, .print-only-report * { 
                visibility: visible !important; 
                height: auto !important;
                overflow: visible !important;
              }
              
              .print-only-report { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 100%; 
                display: block !important;
                background: white !important;
                z-index: 9999;
              }

              @page { 
                size: portrait; 
                margin: 0; 
              }
              
              /* Remove any fixed headers/sidebars from MainLayout during print */
              header, nav, aside, footer { display: none !important; }
            }
            .print-only-report { display: none; }
          `}
        </style>
      </div>
    </MainLayout>
  );
};

export default CommandCenter;
