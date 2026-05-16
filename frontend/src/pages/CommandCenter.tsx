import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Users, AlertTriangle, Shield, BarChart3, Radio,
  ChevronDown,
  Download, MapPin, Bell, X, Search,
  ChevronRight, Truck, Target, MessageSquare, Mic, Clock,
  RefreshCw, CheckCircle, Plus, ExternalLink, User
} from 'lucide-react';
import TeamPanel from './TeamPanel';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import api, { getImageUrl } from '../services/api';

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
  GREEN: '#22C55E',
  YELLOW: '#EAB308',
  RED: '#EF4444',
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
          width:${sz}px;height:${sz}px;border-radius:${sz / 2}px ${sz / 2}px ${sz * 0.35}px ${sz * 0.35}px;
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
          border-left:${sz * 0.22}px solid transparent;
          border-right:${sz * 0.22}px solid transparent;
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

const CIUDADES_PARAGUAY: Record<string, { lat: number; lng: number; zoom: number }> = {
  'PEDRO JUAN CABALLERO': { lat: -22.545, lng: -55.72, zoom: 14 },
  'ASUNCION': { lat: -25.2637, lng: -57.5759, zoom: 13 },
  'ASUNCIÓN': { lat: -25.2637, lng: -57.5759, zoom: 13 },
  'CIUDAD DEL ESTE': { lat: -25.5097, lng: -54.6111, zoom: 13 },
  'ENCARNACION': { lat: -27.3308, lng: -55.8667, zoom: 14 },
  'ENCARNACIÓN': { lat: -27.3308, lng: -55.8667, zoom: 14 },
  'LUQUE': { lat: -25.2708, lng: -57.4872, zoom: 14 },
  'SAN LORENZO': { lat: -25.3400, lng: -57.5094, zoom: 14 },
  'LAMBARE': { lat: -25.3469, lng: -57.6064, zoom: 14 },
  'LAMBARÉ': { lat: -25.3469, lng: -57.6064, zoom: 14 },
  'FERNANDO DE LA MORA': { lat: -25.3390, lng: -57.5230, zoom: 14 },
  'CAPIATA': { lat: -25.3556, lng: -57.4437, zoom: 14 },
  'CAPIATÁ': { lat: -25.3556, lng: -57.4437, zoom: 14 },
  'ITAUGUA': { lat: -25.3889, lng: -57.3536, zoom: 14 },
  'ITAUGUÁ': { lat: -25.3889, lng: -57.3536, zoom: 14 },
  'CAAGUAZU': { lat: -25.4722, lng: -56.0178, zoom: 14 },
  'CAAGUAZÚ': { lat: -25.4722, lng: -56.0178, zoom: 14 },
  'CORONEL OVIEDO': { lat: -25.4492, lng: -56.4419, zoom: 14 },
  'VILLARRICA': { lat: -25.7500, lng: -56.4333, zoom: 14 },
  'CONCEPCION': { lat: -23.4055, lng: -57.4340, zoom: 14 },
  'CONCEPCIÓN': { lat: -23.4055, lng: -57.4340, zoom: 14 },
  'MARIANO ROQUE ALONSO': { lat: -25.2017, lng: -57.5275, zoom: 14 },
  'ÑEMBY': { lat: -25.3964, lng: -57.5383, zoom: 14 },
  'VILLA ELISA': { lat: -25.3750, lng: -57.5917, zoom: 14 },
  'LIMPIO': { lat: -25.1667, lng: -57.4833, zoom: 14 },
  'AREGUA': { lat: -25.3130, lng: -57.3900, zoom: 14 },
  'AREGUÁ': { lat: -25.3130, lng: -57.3900, zoom: 14 },
  'PILAR': { lat: -26.8625, lng: -58.3125, zoom: 14 },
  'SALTO DEL GUAIRA': { lat: -24.0611, lng: -54.3067, zoom: 14 },
  'SALTO DEL GUAIRÁ': { lat: -24.0611, lng: -54.3067, zoom: 14 },
  'HERNANDARIAS': { lat: -25.3971, lng: -54.6430, zoom: 14 },
  'PRESIDENTE FRANCO': { lat: -25.5500, lng: -54.6167, zoom: 14 },
  'MINGA GUAZU': { lat: -25.4833, lng: -54.7667, zoom: 14 },
  'MINGA GUAZÚ': { lat: -25.4833, lng: -54.7667, zoom: 14 },
  'SAN ESTANISLAO': { lat: -24.0000, lng: -56.4333, zoom: 14 },
  'SAN PEDRO DE YCUAMANDIYU': { lat: -24.0933, lng: -57.0828, zoom: 14 },
  'SAN PEDRO DE YCUAMANDIYÚ': { lat: -24.0933, lng: -57.0828, zoom: 14 },
  'SAN LAZARO': { lat: -22.1833, lng: -57.9333, zoom: 14 },
};


/* ─── sub-components ─────────────────────────────────── */


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

      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>{req.type}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: '1.5', wordBreak: 'break-word' }}>{req.description}</p>

      {/* Multimedia Display (Premium) */}
      {(req.photo_url || req.audio_url) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {req.photo_url && (
            <div
              onClick={() => window.open(getImageUrl(req.photo_url) || '', '_blank')}
              style={{
                width: '100%', height: '140px', borderRadius: '12px',
                overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative'
              }}
            >
              <img src={getImageUrl(req.photo_url) || ''} alt="Evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            <p style={{ fontSize: '0.75rem', color: 'var(--text)', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.coordinator_name}</p>
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



const SidebarContent = ({ stats, activities, conflicts, onResolve, settings, onFilter, currentFilter }: any) => {
  const { user } = useAuth();
  const isPadrino = user?.role === 'PADRINO';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Resumen de Mando */}
      <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid var(--border)' }}>
        <h4 style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>Estatus Operativo</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <StatMiniCard 
            label="Capturas" 
            value={stats?.total_captures || 0} 
            color="var(--plra-300)" 
            icon={<Target size={14} />} 
          />
          <StatMiniCard 
            label="Meta" 
            value={settings?.campaign_goal || 1500} 
            color="var(--text-2)" 
            icon={<Shield size={14} />} 
          />
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
          {[
            { key: 'GREEN', color: '#22C55E', label: 'Casa', icon: '🏠' },
            { key: 'YELLOW', color: '#EAB308', label: 'Familia', icon: '👨‍👩‍👧' },
            { key: 'RED', color: '#EF4444', label: 'Otros', icon: '📍' },
            { key: 'PURPLE', color: '#A855F7', label: 'Volunt.', icon: '✨' }
          ].map(f => {
            const active = currentFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onFilter(active ? null : f.key)}
                style={{
                  flex: 1, padding: '0.65rem 0.4rem', borderRadius: '16px',
                  background: active ? `${f.color}35` : `${f.color}12`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${active ? `${f.color}80` : `${f.color}25`}`,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: active ? `0 8px 24px ${f.color}30` : 'none',
                  transform: active ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(0)',
                }}
              >
                <span style={{ fontSize: '0.9rem', marginBottom: '2px', filter: active ? 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' : 'none' }}>{f.icon}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 950, color: active ? 'var(--text-inverse)' : 'var(--text)' }}>
                  {f.key === 'GREEN' ? stats?.green : f.key === 'YELLOW' ? stats?.yellow : f.key === 'RED' ? stats?.red : stats?.purple}
                </span>
                <span style={{ fontSize: '0.42rem', fontWeight: 900, color: active ? 'var(--text-inverse)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* Rendimiento por Local (NUEVO) */}
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Rendimiento por Local</h4>
            <div style={{ padding: '2px 8px', borderRadius: '100px', background: 'rgba(59,130,246,0.1)', color: 'var(--plra-300)', fontSize: '0.55rem', fontWeight: 900 }}>{stats?.locations?.length || 0} LOCALES</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {stats?.locations?.sort((a: any, b: any) => b.percentage - a.percentage).map((loc: any) => (
              <div 
                key={loc.cod_local}
                style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.06)', 
                  borderRadius: '14px', 
                  padding: '0.75rem',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.nombre}</p>
                    <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 700, margin: '1px 0 0' }}>{loc.total_captures} / {loc.total_electors} ELECTORES</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 950, color: loc.percentage > 70 ? 'var(--green)' : loc.percentage > 30 ? 'var(--yellow)' : 'var(--red)' }}>
                      {Math.round(loc.percentage)}%
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar Mini */}
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${loc.percentage}%`, 
                    height: '100%', 
                    background: loc.percentage > 70 ? 'var(--green)' : loc.percentage > 30 ? 'var(--yellow)' : 'var(--red)',
                    boxShadow: `0 0 8px ${loc.percentage > 70 ? 'var(--green)40' : loc.percentage > 30 ? 'var(--yellow)40' : 'var(--red)40'}`,
                    transition: 'width 1s ease-out'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {/* Active Conflicts List */}
        {!isPadrino && conflicts.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Disputas Activas</h4>
              <span style={{ background: 'var(--red)', color: 'white', fontSize: '0.6rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px' }}>{conflicts.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {conflicts.slice(0, 3).map((c: any) => (
                <div key={c.conflict_id} onClick={() => onResolve(c)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '14px', padding: '0.75rem', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white' }}>{c.elector_nombre} {c.elector_apellido}</span>
                    <AlertTriangle size={12} style={{ color: 'var(--red)' }} />
                  </div>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', margin: 0 }}>En disputa por <span style={{ color: 'white', fontWeight: 700 }}>{c.coordinator_name}</span></p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        <section>
          <h4 style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Actividad Reciente</h4>
          {activities.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Sin actividad registrada</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activities.map((a: any) => (
                <div key={a.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                  <div style={{ width: '2px', background: 'var(--border)', position: 'absolute', top: '1.5rem', bottom: '-1rem', left: '15px' }} />
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                    <ActivityIcon action={a.action} />
                  </div>
                  <div style={{ paddingBottom: '0.5rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, margin: '0 0 0.2rem' }}>
                      <span style={{ color: 'var(--plra-300)' }}>{a.user_name || 'Sistema'}</span> {formatAction(a.action)}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {a.entity}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const StatMiniCard = ({ label, value, color, icon }: any) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-3)', marginBottom: '0.4rem' }}>
      {icon}
      <span style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
    <div style={{ fontSize: '1.25rem', fontWeight: 900, color }}>{value}</div>
  </div>
);

const ActivityIcon = ({ action }: { action: string }) => {
  if (action.includes('CREATE')) return <Plus size={14} style={{ color: 'var(--green)' }} />;
  if (action.includes('UPDATE')) return <RefreshCw size={14} style={{ color: 'var(--plra-300)' }} />;
  if (action.includes('RESOLVE')) return <CheckCircle size={14} style={{ color: 'var(--green)' }} />;
  if (action.includes('DISPUTE')) return <AlertTriangle size={14} style={{ color: 'var(--red)' }} />;
  return <Bell size={14} style={{ color: 'var(--text-3)' }} />;
};

const formatAction = (action: string) => {
  const map: any = {
    'CREATE_CAPTURE': 'registró una captura',
    'RESOLVE_CONFLICT': 'resolvió una disputa',
    'CREATE_USER': 'añadió un integrante',
    'UPDATE_PASSWORD': 'cambió su contraseña',
    'RESOLVE_REQUEST': 'gestionó una solicitud'
  };
  return map[action] || action.toLowerCase().replace('_', ' ');
};

const MapHandler = ({ center, selectedLocalId, activeDistrict, locales }: { center: [number, number] | null, selectedLocalId: string | null, activeDistrict?: string, locales?: any[] }) => {
  const map = useMap();
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastDistrict, setLastDistrict] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLocalId && selectedLocalId !== lastId && center) {
      map.flyTo(center, 16, { duration: 1.5 });
      setLastId(selectedLocalId);
    } else if (!selectedLocalId && lastId) {
      setLastId(null);
    }

    if (activeDistrict && activeDistrict !== lastDistrict) {
      const city = activeDistrict.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (CIUDADES_PARAGUAY[city]) {
        map.flyTo([CIUDADES_PARAGUAY[city].lat, CIUDADES_PARAGUAY[city].lng], CIUDADES_PARAGUAY[city].zoom, { duration: 2 });
        setLastDistrict(activeDistrict);
      } else if (locales && locales.length > 0) {
        const validLocales = locales.filter(l => l.lat != null && l.lng != null);
        if (validLocales.length > 0) {
          const bounds = L.latLngBounds(validLocales.map(l => [l.lat, l.lng]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          setLastDistrict(activeDistrict);
        } else {
          // If locales loaded but none have lat/lng, just mark as done
          setLastDistrict(activeDistrict);
        }
      }
    }
  }, [center, selectedLocalId, lastId, map, activeDistrict, lastDistrict, locales]);
  return null;
};

const CommandCenter = () => {
  const { user: authUser, loading, activeListId, activeDistrict } = useAuth();
  const effectiveDistrict = activeDistrict || authUser?.distrito;
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [locales, setLocales] = useState<any[]>([]);
  const [captures, setCaptures] = useState<any[]>([]);
  const [commandStats, setCommandStats] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [conflictsHistory, setConflictsHistory] = useState<any[]>([]);
  const [disputeSearch, setDisputeSearch] = useState('');
  const [disputeLocalFilter, setDisputeLocalFilter] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showResolveModal, setShowResolveModal] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('map');
  const [selectedPadrino, setSelectedPadrino] = useState<any>(null);
  const [selectedCoordDetails, setSelectedCoordDetails] = useState<any>(null);
  const [structureData, setStructureData] = useState<any[]>([]);
  const [subStructureData, setSubStructureData] = useState<any[]>([]);
  const [electorDetails, setElectorDetails] = useState<any[]>([]);
  const [padrinoCaptures, setPadrinoCaptures] = useState<any>(null);
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
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>CASA</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>FAMILIARES</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>OTROS</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>VOLUNTARIO</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>TRANS.</th>
                </tr>
              </thead>
              <tbody>
                {reportData.coordinators.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 700 }}>{c.nombre}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.green}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.yellow}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.red}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.purple}</td>
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
    const handleToggle = () => setShowSidebar(prev => !prev);
    
    window.addEventListener('resize', handleResize);
    document.addEventListener('toggle-sidebar', handleToggle);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('toggle-sidebar', handleToggle);
    };
  }, []);

  const loadData = async () => {
    if (!authUser) return;
    try {
      const params = new URLSearchParams();
      if (activeListId) params.append('listId', activeListId.toString());
      if (selectedLocal) params.append('localId', selectedLocal);
      if (activeDistrict) params.append('district', activeDistrict);

      const queryStr = params.toString();

      // 1. CRITICAL & LIGHT: Fetch core stats and locations first
      // These are essential for the dashboard shell
      api.get(`/stats/command?${queryStr}`).then(res => {
        if (res.data && typeof res.data === 'object' && !Array.isArray(res.data) && !res.data.error) {
          setCommandStats(res.data);
        }
      }).catch(() => { });
      
      api.get('/voting-locations').then(res => {
        if (Array.isArray(res.data)) setLocales(res.data);
      }).catch(() => { });

      // Helper for independent state updates
      const fetchToState = async (url: string, setter: (data: any) => void) => {
        try {
          const res = await api.get(url);
          if (Array.isArray(res.data)) {
            setter(res.data);
          } else {
            console.warn(`Ignored invalid data from ${url} (not an array)`);
          }
        } catch (err) {
          console.warn(`Fetch failed for ${url}:`, err);
        }
      };

      // 2. TACTICAL DATA: Always fetch captures (for the map) but prioritize based on tab
      // On mobile, we might want to skip some non-essential fetches if the connection is slow
      fetchToState(`/captures?${queryStr}`, setCaptures);

      // 3. TAB-SPECIFIC PRIORITY: Only fetch heavy detail data if the tab is active
      // 'hierarchy' replaces old 'structure'
      if (activeTab === 'hierarchy' || activeTab === 'team' || !isMobile) {
        fetchToState(`/users?${queryStr}`, (data) => setCoordinators(data.filter((u: any) => u.role === 'COORDINADOR')));
        fetchToState(`/structure/padrinos?${queryStr}`, setStructureData);
      }

      if (activeTab === 'requests' || activeTab === 'disputes' || !isMobile) {
        fetchToState(`/admin/conflicts?${queryStr}`, setConflicts);
        fetchToState(`/admin/conflicts/history?${queryStr}`, setConflictsHistory);
        fetchToState(`/admin/requests?${queryStr}`, setRequests);
        fetchToState(`/admin/activity?${queryStr}`, setActivities);
      }

      if (showVehicles || !isMobile) {
        fetchToState(`/vehicles?${queryStr}`, setVehicles);
      }

      // Special global check for SuperAdmin
      if (authUser?.role === 'SUPERUSUARIO' && activeListId === null && (activeTab === 'alerts' || !isMobile)) {
        api.get('/admin/disputes/global').catch(() => { });
      }

    } catch (err) {
      console.error("Critical error in loadData:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [activeListId, activeDistrict, selectedLocal, activeTab, authUser]);

  useEffect(() => {
    if (selectedPadrino) {
      api.get(`/structure/padrinos/${selectedPadrino.id}/coordinators`).then(res => {
        setSubStructureData(res.data.coordinators || []);
        setPadrinoCaptures(res.data.padrino_captures || null);
      });
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

  const handleDecide = async (winnerCaptureId: number) => {
    try {
      await api.post('/admin/conflicts/decide', {
        conflict_id: showResolveModal.conflict_id,
        winner_capture_id: winnerCaptureId
      });
      setShowResolveModal(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleConsent = async (conflictId: number) => {
    try {
      await api.post('/admin/conflicts/consent', { conflict_id: conflictId });
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
      userPhoto={getImageUrl(authUser?.photo_url) || ''}
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
          { id: 'map', icon: MapPin, label: 'Mapa Táctico', badge: null },
          { id: 'hierarchy', icon: Shield, label: 'Jerarquía', badge: null },
          { id: 'team', icon: Users, label: 'Mi Equipo', badge: null },
          { id: 'disputes', icon: AlertTriangle, label: 'Disputas', badge: conflicts.length || null },
          { id: 'requests', icon: Bell, label: 'Solicitudes', badge: requests.filter(r => r.status === 'PENDING').length || null },
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
                    padding: '0.45rem 0.8rem', borderRadius: '8px',
                    background: showVehicles ? 'var(--plra-500)' : 'rgba(8, 14, 28, 0.85)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.62rem', fontWeight: 900,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)'
                  }}
                >
                  <Radio size={12} style={{ color: showVehicles ? 'white' : 'var(--plra-300)' }} /> Logística: {showVehicles ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={() => setIsClusteringEnabled(!isClusteringEnabled)}
                  style={{
                    padding: '0.45rem 0.8rem', borderRadius: '8px',
                    background: isClusteringEnabled ? 'var(--plra-500)' : 'rgba(8, 14, 28, 0.85)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.62rem', fontWeight: 900,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)'
                  }}
                >
                  <Target size={12} style={{ color: isClusteringEnabled ? 'white' : 'var(--plra-300)' }} /> Agrupar: {isClusteringEnabled ? 'SI' : 'NO'}
                </button>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowLayerSelector(!showLayerSelector)}
                    style={{
                      padding: '0.45rem 0.8rem', borderRadius: '8px',
                      background: (selectedPadrinoLayers.length > 0 || selectedCoordLayers.length > 0) ? 'var(--plra-500)' : 'rgba(8, 14, 28, 0.85)',
                      color: 'white', border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.62rem', fontWeight: 900,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', width: '100%'
                    }}
                  >
                    <Users size={12} style={{ color: (selectedPadrinoLayers.length > 0 || selectedCoordLayers.length > 0) ? 'white' : 'var(--plra-300)' }} />
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
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <ZoomControl position="bottomright" />
                <MapHandler
                  center={(() => {
                    if (!selectedLocal) return null;
                    const l = locales.find(l => l.cod_local === selectedLocal);
                    if (l && l.lat != null && l.lng != null) return [l.lat, l.lng];
                    return null;
                  })()}
                  selectedLocalId={selectedLocal}
                  activeDistrict={effectiveDistrict}
                  locales={locales}
                />

                {locales.filter(l => l.lat != null && l.lng != null).map((l: any) => {
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
                      .filter(cap => cap.lat != null && cap.lng != null)
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
                                <div style={{ padding: '0.75rem 0.9rem 0.55rem', background: 'linear-gradient(135deg,#081526,#0d1f3c)', borderBottom: '1px solid rgba(59,130,246,0.18)' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.35rem' }}>
                                    <div style={{
                                      width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
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
                      })}
                  </MarkerClusterGroup>
                ) : (
                  captures
                    .filter(cap => cap.lat != null && cap.lng != null)
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
                                  <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
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
                {showVehicles && vehicles.filter(v => v.lat != null && v.lng != null).map((v) => (
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
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>CASA</p>
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
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>OTROS</p>
                      <p style={{ fontSize: '1.1rem', color: 'var(--red)', fontWeight: 900 }}>{conflicts.length > 0 ? conflicts.length : (commandStats?.red || 0)}</p>
                    </div>
                  </div>
                )}

                <div style={{
                  position: 'absolute', bottom: isMobile ? '7rem' : '2rem', left: '1rem', zIndex: 1000,
                  background: 'rgba(8, 14, 26, 0.92)', backdropFilter: 'blur(16px)',
                  padding: '0.85rem 0.9rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  minWidth: '150px'
                }}>
                  <div style={{ fontSize: '0.52rem', fontWeight: 900, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Estado del elector</div>
                  {[
                    { id: 'GREEN', label: 'CASA', color: '#22C55E' },
                    { id: 'YELLOW', label: 'FAMILIARES', color: '#EAB308' },
                    { id: 'RED', label: 'OTROS', color: '#EF4444' },
                    { id: 'PURPLE', label: 'VOLUNTARIO', color: '#A855F7' },
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
                        <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.9)', fontWeight: active ? 900 : 700 }}>
                          {item.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>({commandStats?.[item.id.toLowerCase() as keyof typeof commandStats] || 0})</span>
                        </span>
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
                        {needsTransportFilter ? '✓ ' : ''}TRANSPORTE <span style={{ opacity: 0.6, marginLeft: '4px' }}>({commandStats?.transport_needed || 0})</span>
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
                        style={{
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          color: 'var(--text)', padding: '0.75rem 1.25rem', borderRadius: '16px',
                          cursor: 'pointer', fontWeight: 900, fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                        VOLVER A {selectedCoordDetails ? 'LISTA COORDINADORES' : 'LISTA PADRINOS'}
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
                            <img src={getImageUrl(p.photo_url)} alt="" style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', border: '2px solid var(--plra-500)' }} />
                          ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--plra-600), var(--plra-400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{p.nombre?.charAt(0)}</div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ 
                               fontSize: '0.95rem', fontWeight: 900, color: 'var(--text)', margin: 0, 
                               display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                               overflow: 'hidden', lineHeight: '1.2'
                             }}>{p.nombre}</p>
                            <span style={{ fontSize: '0.55rem', color: 'var(--plra-300)', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              PADRINO LISTA {p.list_number || '3'} {p.option_number ? `OPC ${p.option_number}` : ''}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                          <div style={{ background: 'var(--bg)', padding: '0.5rem 0.2rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.45rem', color: 'var(--text-3)', fontWeight: 800, margin: '0 0 1px' }}>COORDS</p>
                            <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{p.coordinator_count}</p>
                          </div>
                          <div style={{ background: 'rgba(59,130,246,0.1)', padding: '0.5rem 0.2rem', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.2)', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.45rem', color: 'var(--plra-300)', fontWeight: 800, margin: '0 0 1px' }}>CAPTADOS</p>
                            <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{p.total_electors || 0}</p>
                          </div>
                          <div style={{ background: 'rgba(251,191,36,0.1)', padding: '0.5rem 0.2rem', borderRadius: '10px', border: '1px solid rgba(251,191,36,0.2)', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.45rem', color: 'var(--yellow)', fontWeight: 800, margin: '0 0 1px' }}>LOGÍSTICA</p>
                            <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{p.transport_total || 0}</p>
                          </div>
                        </div>
                        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginTop: '1rem', display: 'flex', overflow: 'hidden' }}>
                          {p.total_electors > 0 && (
                            <>
                              <div style={{ width: `${(p.green_total / p.total_electors) * 100}%`, background: 'var(--green)' }} />
                              <div style={{ width: `${(p.yellow_total / p.total_electors) * 100}%`, background: 'var(--yellow)' }} />
                              <div style={{ width: `${(p.red_total / p.total_electors) * 100}%`, background: 'var(--red)' }} />
                              <div style={{ width: `${(p.purple_total / p.total_electors) * 100}%`, background: '#A855F7' }} />
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : !selectedCoordDetails ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {padrinoCaptures && padrinoCaptures.total_electors > 0 && (
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--plra-300)', letterSpacing: '0.15em', marginBottom: '1rem', textTransform: 'uppercase' }}>Mis Capturas Directas (Padrino)</p>
                        <motion.div
                          whileHover={{ y: -3 }}
                          onClick={() => setSelectedCoordDetails({ ...selectedPadrino, role: 'PADRINO_DIRECT' })}
                          style={{
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.05))',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: '20px', padding: '1.25rem', cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--plra-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 900, color: 'white' }}>★</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>Gestión Directa de Padrino</p>
                              <p style={{ fontSize: '0.65rem', color: 'var(--plra-200)', margin: 0, fontWeight: 700 }}>{padrinoCaptures.total_electors} CAPTURAS PROPIAS</p>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '1rem' }}>
                            <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.15)' }}>
                              <p style={{ fontSize: '0.45rem', color: 'var(--green)', fontWeight: 900, margin: '0 0 2px' }}>CASA</p>
                              <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', margin: 0 }}>{padrinoCaptures.green || 0}</p>
                            </div>
                            <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(234,179,8,0.08)', borderRadius: '10px', border: '1px solid rgba(234,179,8,0.15)' }}>
                              <p style={{ fontSize: '0.45rem', color: 'var(--yellow)', fontWeight: 900, margin: '0 0 2px' }}>FAMILIARES</p>
                              <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{padrinoCaptures.yellow || 0}</p>
                            </div>
                            <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                              <p style={{ fontSize: '0.45rem', color: 'var(--red)', fontWeight: 900, margin: '0 0 2px' }}>OTROS</p>
                              <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{padrinoCaptures.red || 0}</p>
                            </div>
                            <div style={{ textAlign: 'center', padding: '0.5rem 0.2rem', background: 'rgba(168,85,247,0.08)', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.15)' }}>
                              <p style={{ fontSize: '0.45rem', color: '#A855F7', fontWeight: 900, margin: '0 0 2px' }}>VOLUNTARIO</p>
                              <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>{padrinoCaptures.purple || 0}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.15)', padding: '0.5rem 0.75rem', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Truck size={14} color="var(--plra-200)" />
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--plra-100)' }}>TRANSPORTE</span>
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'white' }}>{padrinoCaptures.transport_total || 0}</span>
                          </div>
                        </motion.div>
                      </div>
                    )}

                    <div>
                      <p style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', letterSpacing: '0.15em', marginBottom: '1rem', textTransform: 'uppercase' }}>Estructura de Coordinadores</p>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                              {c.photo_url ? (
                                <img src={getImageUrl(c.photo_url)} alt="" style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
                              ) : (
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900, color: 'var(--plra-300)' }}>{c.nombre?.charAt(0)}</div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ 
                                  fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)', margin: 0, 
                                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden', lineHeight: '1.2'
                                }}>{c.nombre}</p>
                                <p style={{ fontSize: '0.55rem', color: 'var(--plra-300)', marginTop: '0.15rem', fontWeight: 800, textTransform: 'uppercase' }}>Coordinador Operativo</p>
                              </div>
                            </div>

                            <div style={{ background: 'var(--bg)', padding: '0.75rem', borderRadius: '14px', border: '1px solid var(--border)', textAlign: 'center', marginBottom: '0.75rem' }}>
                              <p style={{ fontSize: '0.5rem', color: 'var(--text-3)', fontWeight: 800, margin: '0 0 2px', textTransform: 'uppercase' }}>Total Captados</p>
                              <p style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{c.total_electors || 0}</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', marginBottom: '0.75rem' }}>
                              <div style={{ textAlign: 'center', padding: '0.4rem 0.1rem', background: 'rgba(34,197,94,0.12)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)' }}>
                                <p style={{ fontSize: '0.4rem', color: 'var(--green)', fontWeight: 900, margin: '0 0 1px' }}>CASA</p>
                                <p style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{c.green || 0}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '0.4rem 0.1rem', background: 'rgba(234,179,8,0.12)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.2)' }}>
                                <p style={{ fontSize: '0.4rem', color: 'var(--yellow)', fontWeight: 900, margin: '0 0 1px' }}>FAMILIARES</p>
                                <p style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{c.yellow || 0}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '0.4rem 0.1rem', background: 'rgba(239,68,68,0.12)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <p style={{ fontSize: '0.4rem', color: 'var(--red)', fontWeight: 900, margin: '0 0 1px' }}>OTROS</p>
                                <p style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{c.red || 0}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '0.4rem 0.1rem', background: 'rgba(168,85,247,0.12)', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.2)' }}>
                                <p style={{ fontSize: '0.4rem', color: '#A855F7', fontWeight: 900, margin: '0 0 1px' }}>VOLUNTARIO</p>
                                <p style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{c.purple || 0}</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.1)', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.15)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Truck size={12} color="var(--plra-300)" />
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-200)', textTransform: 'uppercase' }}>Logística</span>
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text)' }}>{c.transport_total || 0}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '28px', overflow: 'hidden' }}>
                    <div style={{ padding: '1.75rem', background: 'var(--accent-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--plra-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900, color: 'white' }}>{selectedCoordDetails.nombre.charAt(0)}</div>
                        <div>
                          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{selectedCoordDetails.nombre}</p>
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
                            <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: 'transparent' }}>
                              <td style={{ padding: '1.25rem' }}>
                                <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{e.nombre} {e.apellido}</p>
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
                                  padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: e.traffic_light === 'GREEN' ? 'var(--green)' : e.traffic_light === 'YELLOW' ? 'var(--yellow)' : e.traffic_light === 'PURPLE' ? '#A855F7' : 'var(--red)'
                                  }} />
                                  <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text)' }}>{e.traffic_light}</span>
                                </div>
                              </td>
                              <td style={{ padding: '1.25rem' }}>
                                <button onClick={() => window.open(`https://wa.me/${e.telefono?.replace(/\D/g, '')}`, '_blank')} style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer' }}>
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
          ) : activeTab === 'team' ? (
            /* ── Mi Equipo tab ── */
            <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
              <TeamPanel />
            </div>
          ) : activeTab === 'disputes' ? (
            /* ── Disputas tab ── */
            <div style={{ padding: '2rem', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
              <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.3rem' }}>
                      Panel de <span style={{ color: 'var(--red)' }}>Disputas</span>
                    </h2>
                    <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 700 }}>RESOLUCIÓN TÁCTICA DE CONFLICTOS DE CAPTACIÓN</p>
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.1)', padding: '0.6rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)', fontWeight: 900, fontSize: '0.8rem' }}>
                    {conflicts.length} ACTIVAS
                  </div>
                </header>

                {/* Active Disputes Grid */}
                {conflicts.length === 0 ? (
                  <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '24px', border: '1px dashed var(--border)' }}>
                    <CheckCircle size={48} style={{ color: 'var(--green)', marginBottom: '1.5rem', opacity: 0.5 }} />
                    <h3 style={{ color: 'var(--text)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Territorio Controlado</h3>
                    <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>No hay disputas vigentes en este distrito.</p>
                  </div>
                ) : (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)', 
                    gap: '1rem',
                    marginBottom: '3rem'
                  }}>
                    {conflicts.map((conf: any) => {
                      const statusColor = conf.tl_a === 'GREEN' ? '#10b981' : conf.tl_a === 'YELLOW' ? '#f59e0b' : conf.tl_a === 'PURPLE' ? '#a855f7' : '#ef4444';
                      
                      return (
                        <motion.div
                          whileHover={{ y: -4, scale: 1.02 }}
                          key={conf.conflict_id}
                          onClick={() => setShowResolveModal(conf)}
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '20px',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: 'var(--shadow-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: '180px'
                          }}
                        >
                          {/* Compact Summary Header */}
                          <div style={{ 
                            padding: '1rem', 
                            background: `linear-gradient(180deg, ${statusColor}44 0%, transparent 100%)`,
                            borderBottom: '1px solid var(--border)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{ 
                                    fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)', margin: 0, 
                                    display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden', lineHeight: '1.2'
                                }}>
                                  {conf.elector_nombre} {conf.elector_apellido}
                                </h4>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, margin: '2px 0 0' }}>CI: {conf.elector_ci}</p>
                              </div>
                              <div style={{ 
                                width: '20px', height: '6px', borderRadius: '3px', 
                                background: statusColor, boxShadow: `0 0 12px ${statusColor}66`
                              }} />
                            </div>
                          </div>

                          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={12} style={{ color: 'var(--plra-300)' }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Captura Inicial</p>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conf.coord_a}</p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AlertTriangle size={12} style={{ color: 'var(--red)' }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Última Captura</p>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conf.coord_b}</p>
                                </div>
                            </div>
                          </div>

                          <div style={{ 
                                marginTop: 'auto',
                                fontSize: '0.5rem', fontWeight: 900, 
                                color: 'var(--text-inverse)', 
                                textAlign: 'center', background: 'var(--plra-600)', padding: '5px',
                                letterSpacing: '0.5px', textTransform: 'uppercase'
                          }}>
                              <AlertTriangle size={10} style={{ display: 'inline', marginRight: '4px' }} /> Ver Detalles y Resolver
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* History Log with Advanced Filters */}
                <div style={{ background: 'var(--surface)', borderRadius: '28px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Historial de Resoluciones</h3>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                        <input 
                          type="text" 
                          placeholder="Buscar elector..." 
                          value={disputeSearch}
                          onChange={(e) => setDisputeSearch(e.target.value)}
                          style={{ padding: '0.5rem 1rem 0.5rem 2.25rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', width: '200px' }} 
                        />
                      </div>
                      <select 
                        value={disputeLocalFilter}
                        onChange={(e) => setDisputeLocalFilter(e.target.value)}
                        style={{ padding: '0.5rem 1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem' }}
                      >
                        <option value="">Todos los locales</option>
                        {locales.map(l => <option key={l.cod_local} value={l.nombre}>{l.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '1rem 2rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Elector</th>
                          <th style={{ padding: '1rem 2rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Local / Mesa</th>
                          <th style={{ padding: '1rem 2rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Adjudicado a</th>
                          <th style={{ padding: '1rem 2rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase' }}>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflictsHistory
                          .filter(h => !disputeSearch || (h.elector_nombre + ' ' + h.elector_apellido).toUpperCase().includes(disputeSearch.toUpperCase()))
                          .filter(h => !disputeLocalFilter || h.local_votacion === disputeLocalFilter)
                          .map((h: any) => (
                          <tr key={h.conflict_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '1rem 2rem' }}>
                              <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{h.elector_nombre} {h.elector_apellido}</p>
                              <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>CI: {h.elector_ci}</p>
                            </td>
                            <td style={{ padding: '1rem 2rem' }}>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', margin: 0 }}>{h.local_votacion}</p>
                              <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>Mesa {h.mesa}</p>
                            </td>
                            <td style={{ padding: '1rem 2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900 }}>{h.winner_name?.charAt(0)}</div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{h.winner_name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '1rem 2rem', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                              {new Date(h.resolved_at).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                        {conflictsHistory.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>No hay registros en el historial.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Solicitudes tab ── */
            <div style={{ padding: 'clamp(1rem, 3vw, 2rem)', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.4rem' }}>
                      Solicitudes <span style={{ color: 'var(--plra-300)' }}>de Campo</span>
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 600 }}>MONITOREO DE INCIDENTES Y REQUERIMIENTOS</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {requests.filter(r => r.status === 'PENDING').length > 0 && (
                      <div style={{ padding: '0.6rem 1.25rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px', color: 'var(--red)', fontSize: '0.75rem', fontWeight: 900, boxShadow: '0 4px 15px rgba(239,68,68,0.2)' }}>
                        {requests.filter(r => r.status === 'PENDING').length} PENDIENTES
                      </div>
                    )}
                  </div>
                </div>

                {requests.length === 0 ? (
                  <div className="empty-state-card" style={{ padding: '5rem 2rem', background: 'var(--surface)', borderRadius: '32px', border: '1px solid var(--border)' }}>
                    <div className="icon-pulse" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--plra-300)', width: '80px', height: '80px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                      <Bell size={40} />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>Sin Solicitudes Activas</h3>
                    <p style={{ color: 'var(--text-3)', fontSize: '1rem' }}>No hay incidentes ni solicitudes de campo reportadas en este momento.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.5rem' }}>
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
            <div className="modal-overlay" onClick={() => setShowResolveModal(null)} style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>
              <motion.div
                className="modal-content"
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '950px', width: '95%', padding: 0, borderRadius: '28px', border: '1px solid var(--border)', overflow: 'hidden' }}
              >
                {/* Tactical Header */}
                {(() => {
                  const statusColor = showResolveModal.tl_a === 'GREEN' ? '#10b981' : showResolveModal.tl_a === 'YELLOW' ? '#f59e0b' : showResolveModal.tl_a === 'PURPLE' ? '#a855f7' : '#ef4444';
                  return (
                    <div style={{ 
                        padding: '2rem', 
                        background: `linear-gradient(135deg, ${statusColor}cc 0%, rgba(15,23,42,0.95) 100%)`,
                        borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: 'white' }}>
                                    {showResolveModal.elector_nombre} {showResolveModal.elector_apellido}
                                </h3>
                                <div style={{ padding: '4px 12px', borderRadius: '100px', background: statusColor, color: 'white', fontSize: '0.65rem', fontWeight: 900, boxShadow: `0 0 20px ${statusColor}80` }}>
                                    DISPUTA ACTIVA
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 700 }}>
                                <span>CI: {showResolveModal.elector_ci}</span>
                                {showResolveModal.transport_a === 1 && <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Truck size={14} /> REQUIERE TRANSPORTE</span>}
                            </div>
                        </div>
                        <AlertTriangle size={48} style={{ color: 'white', opacity: 0.2 }} />
                    </div>
                  )
                })()}

                <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem', background: 'var(--surface)' }}>
                  {/* Contender A Detail */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ padding: '1.5rem', borderRadius: '24px', background: 'var(--bg)', border: '1px solid var(--border)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: -12, left: 24, padding: '4px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>Captura Inicial · Lista {showResolveModal.list_a}</div>
                        
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: showResolveModal.photo_a ? `url(${getImageUrl(showResolveModal.photo_a)}) center/cover` : 'var(--border)', border: '2px solid var(--plra-400)' }} />
                            <div>
                                <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{showResolveModal.coord_a}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700, margin: 0 }}>Padrino: <span style={{ color: 'var(--plra-300)' }}>{showResolveModal.padrino_a || 'N/A'}</span></p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Capturado el</p>
                                <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text)' }}>
                                    {new Date(showResolveModal.time_a).toLocaleDateString('es-PY')}
                                    <div style={{ color: 'var(--plra-300)' }}>{new Date(showResolveModal.time_a).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</div>
                                </p>
                            </div>
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${showResolveModal.lat_a},${showResolveModal.lng_a}`} 
                                target="_blank" rel="noreferrer"
                                style={{ 
                                    padding: '1rem', borderRadius: '16px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)',
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center', textDecoration: 'none'
                                }}
                            >
                                <p style={{ fontSize: '0.6rem', color: 'var(--plra-300)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={10} /> Ubicación de Captura
                                </p>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-2)' }}>Verificar en Mapa <ExternalLink size={10} style={{ marginLeft: '4px' }} /></p>
                            </a>
                        </div>

                        <button 
                            onClick={() => handleDecide(showResolveModal.capture_a_id)}
                            style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: 'var(--shadow-sm)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-4)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-3)'}
                        >
                            ADJUDICAR
                        </button>
                    </div>
                  </div>

                  {/* Contender B Detail */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ padding: '1.5rem', borderRadius: '24px', background: 'var(--bg)', border: '1px solid var(--border)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: -12, left: 24, padding: '4px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>Última Captura · Lista {showResolveModal.list_b}</div>
                        
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: showResolveModal.photo_b ? `url(${getImageUrl(showResolveModal.photo_b)}) center/cover` : 'var(--border)', border: '2px solid var(--red)' }} />
                            <div>
                                <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{showResolveModal.coord_b}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700, margin: 0 }}>Padrino: <span style={{ color: 'var(--red)' }}>{showResolveModal.padrino_b || 'N/A'}</span></p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Capturado el</p>
                                <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text)' }}>
                                    {new Date(showResolveModal.time_b).toLocaleDateString('es-PY')}
                                    <div style={{ color: 'var(--red)' }}>{new Date(showResolveModal.time_b).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</div>
                                </p>
                            </div>
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${showResolveModal.lat_b},${showResolveModal.lng_b}`} 
                                target="_blank" rel="noreferrer"
                                style={{ 
                                    padding: '1rem', borderRadius: '16px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center', textDecoration: 'none'
                                }}
                            >
                                <p style={{ fontSize: '0.6rem', color: 'var(--red)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={10} /> Ubicación de Captura
                                </p>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-2)' }}>Verificar en Mapa <ExternalLink size={10} style={{ marginLeft: '4px' }} /></p>
                            </a>
                        </div>

                        <button 
                            onClick={() => handleDecide(showResolveModal.capture_b_id)}
                            style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: 'var(--shadow-sm)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-4)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-3)'}
                        >
                            ADJUDICAR
                        </button>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1rem 2rem 2rem', background: 'var(--surface)', display: 'flex', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setShowResolveModal(null)} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Cerrar sin cambios
                  </button>
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
