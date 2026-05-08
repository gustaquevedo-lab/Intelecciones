import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Users, AlertTriangle, Shield, BarChart3, Radio,
  TrendingUp, TrendingDown, ChevronUp, ChevronDown,
  Download, MapPin, Activity, Bell, X, Search,
  AlertCircle, ChevronRight, Truck, Target, Phone, MessageSquare, Mic, Clock
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { ManagementTable } from '../components/ManagementTable';
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

const createCustomIcon = (color: string, iconName: string = 'Landmark', needsTransport: boolean = false) => L.divIcon({
  html: `
    <div style="
      background-color: ${color};
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: 2px solid ${needsTransport ? 'var(--plra-300)' : 'white'};
      box-shadow: ${needsTransport ? '0 0 12px var(--plra-300)' : '0 2px 5px rgba(0,0,0,0.3)'};
      position: relative;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${ICON_SVGS[needsTransport ? 'Car' : iconName] || ICON_SVGS.Landmark}
      </svg>
      ${needsTransport ? `
        <div style="
          position: absolute;
          top: -5px;
          right: -5px;
          background: white;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        ">
          <div style="background: var(--plra-300); width: 8px; height: 8px; border-radius: 50%;"></div>
        </div>
      ` : ''}
    </div>
  `,
  className: 'custom-div-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

const API_BASE = 'http://localhost:5000/api';

/* ─── sub-components ─────────────────────────────────── */

const StatCard = ({ label, value, delta, trend, color, bg, border, isTactical, onClick, active }: any) => (
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
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
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

const SidebarContent = ({ stats, activities, conflicts, onResolve, settings, isReadOnly, onFilter, currentFilter }: { stats: any, activities: any[], conflicts: any[], onResolve: (c: any) => void, settings: any, isReadOnly: boolean, onFilter: (f: string | null) => void, currentFilter: string | null }) => {
  const { isDark } = useTheme();
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
  const { user: authUser, loading, activeListId } = useAuth();
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
  const [globalDisputes, setGlobalDisputes] = useState<any[]>([]);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showResolveModal, setShowResolveModal] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('map');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isClusteringEnabled, setIsClusteringEnabled] = useState(true);
  const [trafficLightFilter, setTrafficLightFilter] = useState<string | null>(null);

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

      const [locRes, statRes, capRes, confRes, reqRes, actRes, vehRes] = await Promise.all([
        api.get('/voting-locations'),
        api.get(`/stats/command?${params.toString()}`),
        api.get(`/captures?${params.toString()}`),
        api.get('/admin/conflicts'),
        api.get('/admin/requests'),
        api.get('/admin/activity'),
        api.get('/vehicles')
      ]);
      setLocales(locRes.data);
      setCommandStats(statRes.data);
      setCaptures(capRes.data);
      setConflicts(confRes.data);
      setRequests(reqRes.data);
      setActivities(actRes.data);
      setVehicles(vehRes.data);

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
    const interval = setInterval(loadData, 15000); // 15 seconds is enough for real-time monitoring without overload
    return () => clearInterval(interval);
  }, [activeListId, selectedLocal]);

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

  const handleSearch = async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setActiveTab('registry');
    try {
      const res = await api.get(`/admin/electors/search?q=${query}`);
      setSearchResults(res.data);
    } catch (err) { console.error(err); }
    setIsSearching(false);
  };

  useEffect(() => {
    (window as any).handleStrategicSearch = handleSearch;
  }, []);

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

      <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '2rem', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
        <div 
          onClick={() => setActiveTab('map')}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            color: activeTab === 'map' ? 'var(--plra-300)' : 'var(--text-3)',
            borderBottom: activeTab === 'map' ? '2px solid var(--plra-300)' : 'none',
            paddingBottom: '0.25rem'
          }}
        >
          <MapPin size={16} /> <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Mapa Táctico</span>
        </div>
        <div 
          onClick={() => setActiveTab('requests')}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            color: activeTab === 'requests' ? 'var(--plra-300)' : 'var(--text-3)',
            borderBottom: activeTab === 'requests' ? '2px solid var(--plra-300)' : 'none',
            paddingBottom: '0.25rem'
          }}
        >
          <Bell size={16} /> <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Centro de Control</span>
          {requests.filter(r => r.status === 'PENDING').length > 0 && (
            <span style={{ background: 'var(--red)', color: 'white', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '10px' }}>
              {requests.filter(r => r.status === 'PENDING').length}
            </span>
          )}
        </div>
        <div 
          onClick={() => setActiveTab('registry')}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            color: activeTab === 'registry' ? 'var(--plra-300)' : 'var(--text-3)',
            borderBottom: activeTab === 'registry' ? '2px solid var(--plra-300)' : 'none',
            paddingBottom: '0.25rem'
          }}
        >
          <Users size={16} /> <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Registro de Electores</span>
        </div>
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
                          <Popup>
                            <div style={{ padding: '0.4rem', minWidth: '160px' }}>
                              <p style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.2rem', color: 'var(--text)', textTransform: 'uppercase', lineHeight: 1.1 }}>{cap.nombre} {cap.apellido}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
                                <span style={{ fontSize: '0.55rem', fontWeight: 900, padding: '1px 4px', borderRadius: '3px', background: 'var(--plra-500)', color: 'white' }}>
                                  L-{cap.list_number}
                                </span>
                                <span style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 700 }}>{cap.campaign_name?.substring(0, 15)}</span>
                              </div>
                              <div style={{ marginBottom: '0.4rem', padding: '0.3rem 0.4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <p style={{ fontSize: '0.6rem', color: 'var(--text-2)', margin: 0 }}>
                                  <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Captado:</span> {cap.coordinator_name} 
                                </p>
                              </div>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <MapPin size={10} /> {cap.local_votacion}
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
                        <Popup>
                           <div style={{ padding: '0.4rem', minWidth: '160px' }}>
                              <p style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.2rem', color: 'var(--text)', textTransform: 'uppercase', lineHeight: 1.1 }}>{cap.nombre} {cap.apellido}</p>
                              <div style={{ fontSize: '0.55rem', fontWeight: 900, padding: '1px 4px', borderRadius: '3px', background: 'var(--plra-500)', color: 'white', display: 'inline-block' }}>L-{cap.list_number}</div>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '0.4rem' }}><MapPin size={10} /> {cap.local_votacion}</div>
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
                  background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(12px)',
                  padding: '0.85rem', borderRadius: '14px', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: '0.65rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--text-3)', marginBottom: '0.2rem', letterSpacing: '0.05em' }}>FILTRAR POR ESTADO:</div>
                  {[
                    { id: 'GREEN', label: 'A FAVOR', color: 'var(--green)' },
                    { id: 'YELLOW', label: 'DUDOSO', color: 'var(--yellow)' },
                    { id: 'RED', label: 'EN CONTRA', color: 'var(--red)' }
                  ].map(item => (
                    <div 
                      key={item.id}
                      onClick={() => setTrafficLightFilter(trafficLightFilter === item.id ? null : item.id)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                        opacity: !trafficLightFilter || trafficLightFilter === item.id ? 1 : 0.3,
                        transition: '0.2s',
                        background: trafficLightFilter === item.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                        padding: '0.3rem 0.5rem', borderRadius: '6px',
                        margin: '0 -0.3rem'
                      }}
                    >
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color, boxShadow: trafficLightFilter === item.id ? `0 0 10px ${item.color}` : 'none' }} />
                      <span style={{ fontSize: '0.65rem', color: 'white', fontWeight: 800 }}>{item.label}</span>
                    </div>
                  ))}
                  
                  {trafficLightFilter && (
                    <button 
                      onClick={() => setTrafficLightFilter(null)}
                      style={{ 
                        marginTop: '0.2rem', padding: '0.3rem', borderRadius: '6px', 
                        background: 'var(--accent-subtle)', border: '1px solid var(--border)',
                        color: 'var(--plra-300)', fontSize: '0.55rem', fontWeight: 800, cursor: 'pointer'
                      }}
                    >
                      LIMPIAR FILTRO
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.6rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--plra-300)' }} />
                    <span style={{ fontSize: '0.6rem', color: 'var(--plra-200)', fontWeight: 800 }}>REQUIERE TRANSPORTE</span>
                  </div>
                </div>
              </MapContainer>
            </div>
          ) : activeTab === 'registry' ? (
            <div style={{ 
              height: '100%', 
              overflowY: 'auto', 
              padding: isMobile ? '1rem' : '2rem', 
              background: 'var(--surface-dark)',
              zIndex: 1200, // Ensure it covers the map on mobile if needed
              position: 'relative'
            }}>
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>
                    Consulta de <span style={{ color: 'var(--plra-300)' }}>Padrón</span>
                  </h2>
                  <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Localice electores, verifique locales de votación y coordine acciones tácticas.</p>
                </header>

                <div className="card-premium-styled" style={{ 
                  padding: '1.5rem', 
                  marginBottom: '2rem',
                  border: '1px solid var(--plra-500)',
                  background: 'rgba(59,130,246,0.05)'
                }}>
                  <div className="search-input-wrapper-premium">
                    <Search size={20} style={{ marginLeft: '1rem', color: 'var(--plra-300)' }} />
                    <input 
                      type="text" 
                      className="modern-input-premium-styled" 
                      placeholder="Nombre, Apellido o Número de Cédula..."
                      style={{ paddingLeft: '3rem', fontSize: '1rem' }}
                      onChange={(e) => handleSearch(e.target.value)}
                      autoFocus
                    />
                    {isSearching && (
                      <div className="loading-spinner-small" style={{ marginRight: '1rem' }} />
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  {searchResults.map((elector: any) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={elector.ci} 
                      className="card-premium-styled" 
                      style={{ 
                        padding: '1.25rem',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.1rem' }}>{elector.nombre} {elector.apellido}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--plra-300)', fontWeight: 700 }}>C.I. {elector.ci}</p>
                        </div>
                        <div style={{ 
                          padding: '4px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)',
                          fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', border: '1px solid rgba(59,130,246,0.2)'
                        }}>
                          {elector.partido || 'PLRA'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '10px' }}>
                        <div>
                          <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Local</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text)', fontWeight: 600 }}>{elector.local_votacion}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Mesa / Orden</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text)', fontWeight: 600 }}>Mesa {elector.mesa} — # {elector.orden}</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button 
                          className="action-btn-primary" 
                          style={{ flex: 1, padding: '0.4rem', fontSize: '0.65rem', gap: '0.3rem', borderRadius: '8px' }}
                          onClick={() => {
                            if (elector.lat && elector.lng) {
                              setSelectedLocal(null);
                              setActiveTab('map');
                            } else {
                              alert('Ubicación de contacto no disponible.');
                            }
                          }}
                        >
                          <MapPin size={12} /> UBICAR
                        </button>
                        {elector.coordinator_name && (
                          <div style={{ flex: 1.5, background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ fontSize: '0.65rem', color: 'var(--plra-300)', fontWeight: 800, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{elector.coordinator_name}</p>
                            <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 700, margin: 0 }}>{elector.coordinator_role}</p>
                          </div>
                        )}
                        <button 
                          className="action-btn-secondary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', gap: '0.3rem', background: 'rgba(34,197,94,0.1)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.2)', borderRadius: '8px' }}
                          onClick={() => window.open(`https://wa.me/${elector.telefono?.replace(/\D/g, '')}`, '_blank')}
                          disabled={!elector.telefono}
                        >
                          <MessageSquare size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  
                  {!isSearching && searchResults.length === 0 && (
                    <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-3)', background: 'rgba(255,255,255,0.01)', borderRadius: '20px', border: '1px dashed var(--border)' }}>
                      <Search size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                      <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No hay electores que coincidan con la búsqueda</p>
                      <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Intente buscar por el número de Cédula para mayor precisión.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'requests' ? (
            <div style={{ padding: '2rem', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>Centro de Decisiones Estratégicas</h3>
                  <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Aprueba o rechaza las solicitudes de los coordinadores en campo.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', textAlign: 'center', minWidth: '100px' }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--yellow)' }}>{requests.filter(r => r.status === 'PENDING').length}</p>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pendientes</p>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {authUser?.role === 'SUPERUSUARIO' && globalDisputes.length > 0 && (
                    <div style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>Disputas Globales Detectadas</h3>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Electores captados por más de una lista simultáneamente.</p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {globalDisputes.map((d, i) => (
                          <div key={i} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239,68,68,0.1)' }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{d.nombre} {d.apellido}</p>
                              <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>CI: {d.ci} | {d.local_votacion}</p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase' }}>Listas en conflicto:</p>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', lineHeight: '1.4' }}>
                                {d.details.split(',').map((detail: string, idx: number) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--red)' }} />
                                    {detail}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-300)' }}>
                          <Radio size={20} />
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Solicitudes de Campo</h3>
                      </div>
                      {requests.map(req => (
                        <RequestItem key={req.id} req={req} isReadOnly={authUser?.role === 'CANDIDATO'} onResolve={(status) => handleResolveRequest(req.id, status)} />
                      ))}
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
                          <AlertTriangle size={20} />
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Disputas Internas (Misma Lista)</h3>
                      </div>
                      {conflicts.map(conf => (
                        <div key={conf.id} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: '0.75rem' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>{conf.nombre} {conf.apellido}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: '1rem' }}>Elector captado por múltiples coordinadores de tu lista.</p>
                          {authUser?.role !== 'CANDIDATO' ? (
                            <button onClick={() => setShowResolveModal(conf)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', background: 'var(--red)', color: 'white', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                              Resolver Conflicto Interno
                            </button>
                          ) : (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontStyle: 'italic' }}>En revisión por comando...</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
            </div>
          ) : (
            <div style={{ padding: 'clamp(1rem, 3vw, 2rem)', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>Padrón Electoral Inteligente</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Búsqueda y gestión avanzada de electores por local y mesa.</p>
                </div>
                <div style={{ 
                  padding: '0.5rem 1rem', background: 'var(--accent-subtle)', border: '1px solid var(--border)', 
                  borderRadius: '10px', color: 'var(--plra-300)', fontSize: '0.75rem', fontWeight: 800 
                }}>
                  {searchResults.length} Registros Encontrados
                </div>
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
                <ManagementTable 
                  isLoading={isSearching}
                  data={searchResults}
                  columns={[
                    { header: 'CI', accessor: 'ci', width: '120px' },
                    { header: 'Nombre Completo', accessor: (e: any) => `${e.nombre} ${e.apellido}` },
                    { header: 'Local de Votación', accessor: 'local_votacion' },
                    { header: 'Mesa', accessor: 'mesa', width: '80px' },
                    { 
                      header: 'Estado', 
                      accessor: (e: any) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ 
                            width: '10px', height: '10px', borderRadius: '50%', 
                            background: e.traffic_light === 'GREEN' ? 'var(--green)' : e.traffic_light === 'YELLOW' ? 'var(--yellow)' : e.traffic_light === 'RED' ? 'var(--red)' : 'var(--text-3)',
                            boxShadow: e.traffic_light ? `0 0 8px ${e.traffic_light === 'GREEN' ? 'var(--green)' : e.traffic_light === 'YELLOW' ? 'var(--yellow)' : 'var(--red)'}` : 'none'
                          }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: e.traffic_light ? 'var(--text)' : 'var(--text-3)' }}>
                            {e.traffic_light ? 'CAPTADO' : 'PENDIENTE'}
                          </span>
                        </div>
                      )
                    },
                    { header: 'Responsable', accessor: 'coordinator_name' }
                  ]}
                />
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
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                      padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' 
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, padding: '2px 8px', background: 'var(--plra-500)', color: 'white', fontSize: '0.55rem', fontWeight: 800, borderRadius: '0 0 8px 0', zIndex: 10 }}>CAPTURA ORIGINAL</div>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', marginBottom: '0.2rem' }}>{showResolveModal.original_coordinator_name}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600, marginBottom: '0.75rem' }}>Superior: <span style={{ color: 'var(--plra-200)' }}>{showResolveModal.original_parent_name || 'Mando Directo'}</span></p>
                          
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
                      padding: '1.25rem', borderRadius: '16px', background: 'rgba(239,68,68,0.03)', 
                      border: '1px solid rgba(239,68,68,0.2)', position: 'relative', overflow: 'hidden' 
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, padding: '2px 8px', background: 'var(--red)', color: 'white', fontSize: '0.55rem', fontWeight: 800, borderRadius: '0 0 8px 0', zIndex: 10 }}>NUEVA DISPUTA</div>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', marginBottom: '0.2rem' }}>{showResolveModal.coordinator_name}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600, marginBottom: '0.75rem' }}>Superior: <span style={{ color: 'var(--plra-200)' }}>{showResolveModal.parent_name || 'Mando Directo'}</span></p>
                          
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
      </div>
    </MainLayout>
  );
};

export default CommandCenter;
