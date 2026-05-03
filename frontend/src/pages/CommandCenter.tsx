import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Users, AlertTriangle, Shield, BarChart3, Radio,
  TrendingUp, TrendingDown, ChevronUp, ChevronDown,
  Download, MapPin, Activity, Bell, X, Search,
  AlertCircle, ChevronRight, Truck, Target
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { ManagementTable } from '../components/ManagementTable';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownCard } from '../components/CountdownCard';
import api from '../services/api';

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

const StatCard = ({ label, value, delta, trend, color, bg, border }: any) => (
  <div style={{
    background: bg, border: `1px solid ${border}`,
    borderRadius: '12px', padding: '0.9rem 1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transition: 'border-color 0.2s',
  }}>
    <div>
      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
        {label}
      </span>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem', color: 'var(--text)', lineHeight: 1.1, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {trend === 'up'   && <TrendingUp  size={18} style={{ color }} />}
        {trend === 'down' && <TrendingDown size={18} style={{ color }} />}
        {!trend           && <Activity    size={18} style={{ color: 'var(--text-3)' }} />}
      </div>
    </div>
  </div>
);

const RequestItem = ({ req, onResolve }: { req: any, onResolve: (status: string) => void }) => {
  const priorityColors = {
    CRITICAL: 'var(--red)',
    HIGH: 'var(--yellow)',
    NORMAL: 'var(--plra-300)'
  };
  return (
    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: priorityColors[req.priority as keyof typeof priorityColors] }}>{req.priority}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{new Date(req.timestamp).toLocaleTimeString()}</span>
      </div>
      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem' }}>{req.type}</p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '1rem' }}>{req.description}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'white', fontWeight: 800 }}>
          {req.coordinator_name?.charAt(0)}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{req.coordinator_name}</span>
      </div>
      {req.status === 'PENDING' ? (
        !isReadOnly ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onResolve('APPROVED')} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', background: 'var(--green)', color: 'white', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Aprobar</button>
            <button onClick={() => onResolve('REJECTED')} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', background: 'rgba(239,68,68,0.2)', color: 'var(--red)', border: '1px solid var(--red)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Rechazar</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '0.4rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)', fontSize: '0.7rem', fontStyle: 'italic' }}>
            Esperando decisión de mando
          </div>
        )
      ) : (
        <div style={{ textAlign: 'center', padding: '0.4rem', borderRadius: '8px', background: req.status === 'APPROVED' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: req.status === 'APPROVED' ? 'var(--green)' : 'var(--red)', fontSize: '0.7rem', fontWeight: 700 }}>
          {req.status === 'APPROVED' ? 'APROBADO' : 'RECHAZADO'}
        </div>
      )}
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
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>{act.user_name}</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--text-2)' }}>{act.type === 'CAPTURE' ? 'Captó a ' : act.type === 'CONFLICT' ? 'Generó conflicto: ' : 'Solicitó: '}</span>
            <span style={{ color: 'white', fontWeight: 600 }}>{act.entity_name}</span>
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
        <Activity size={14} style={{ color: 'var(--plra-300)' }} />
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

const SidebarContent = ({ stats, activities, conflicts, onResolve, settings }: { stats: any, activities: any[], conflicts: any[], onResolve: (c: any) => void, settings: any }) => {
  const criticalLocs = stats?.locations?.filter((l: any) => parseFloat(l.percentage) < 30).sort((a: any, b: any) => parseFloat(a.percentage) - parseFloat(b.percentage)).slice(0, 3) || [];
  const topCoordinators = stats?.top_coordinators || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.25rem' }}>
      <CountdownCard 
        targetDate={settings.election_date} 
        title="Elecciones Internas PLRA" 
      />

      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input 
          type="text" 
          placeholder="Buscar elector (Nombre o C.I.)..."
          onKeyDown={(e) => e.key === 'Enter' && (window as any).handleStrategicSearch((e.target as HTMLInputElement).value)}
          style={{
            width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: '12px', color: 'white', fontSize: '0.8rem',
            outline: 'none', transition: 'border-color 0.2s'
          }}
        />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
          <Activity size={12} style={{ color: 'var(--plra-300)' }} />
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
            Actividad Reciente
          </span>
        </div>
        <ActivityFeed activities={activities} />
      </div>

      {criticalLocs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <AlertCircle size={12} style={{ color: 'var(--red)' }} />
            <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--red)', fontFamily: 'var(--font-display)' }}>
              Puntos Críticos
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {criticalLocs.map((l: any) => (
              <div key={l.cod_local} style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                  <span style={{ color: 'white', fontWeight: 700 }}>{l.nombre}</span>
                  <span style={{ color: 'var(--red)', fontWeight: 800 }}>{l.percentage}%</span>
                </div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '5px' }}>
                  <div style={{ width: `${l.percentage}%`, height: '100%', background: 'var(--red)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCoordinators.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <TrendingUp size={12} style={{ color: 'var(--plra-300)' }} />
            <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
              Ranking de Coordinadores
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {topCoordinators.map((c: any, i: number) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '20px', fontSize: '0.65rem', fontWeight: 900, color: i === 0 ? 'var(--yellow)' : 'var(--text-3)' }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                  <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.03)', marginTop: '3px' }}>
                    <div style={{ width: `${(c.capture_count / (topCoordinators[0].capture_count || 1)) * 100}%`, height: '100%', background: i === 0 ? 'var(--plra-300)' : 'var(--border)' }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--plra-200)' }}>{c.capture_count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <BarChart3 size={12} style={{ color: 'var(--text-3)' }} />
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
            Métricas Globales
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <StatCard label="A Favor" value={stats?.green || 0} trend="up" color="var(--green)" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.2)" />
          <StatCard label="Pendientes" value={(stats?.total_electors - stats?.total_captures) || 0} trend={null} color="var(--text-2)" bg="rgba(59,130,246,0.04)" border="var(--border)" />
        </div>
        <ProjectionCard currentCount={stats?.total_captures || 0} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={12} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
              Conflictos
            </span>
          </div>
          <span style={{ background: conflicts.length > 0 ? 'var(--red)' : 'var(--green)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
            {conflicts.length}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {conflicts.slice(0, 3).map(c => (
            <div key={c.conflict_id} onClick={() => onResolve(c)} style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>{c.elector_nombre}</p>
              <p style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>Doble captura detectada</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CommandCenter = () => {
  const { user: authUser, loading, activeListId } = useAuth();
  const { settings } = useSettings();
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
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [activeListId]);

  const handleResolveRequest = async (requestId: number, status: string) => {
    try {
      await api.post(`/admin/requests/${requestId}/resolve`, {
        status,
        resolved_by_id: authUser?.id
      });
      loadData();
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

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
      setActiveTab('map');
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
          onClick={() => { setActiveTab('registry'); handleSearch(''); }}
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
        gridTemplateColumns: isMobile ? '1fr' : (showSidebar ? '300px 1fr' : '0px 1fr'), 
        height: isMobile ? 'calc(100vh - 110px)' : 'calc(100vh - 110px)', 
        overflow: 'hidden',
        position: 'relative',
        transition: 'grid-template-columns 0.3s ease'
      }}>
        {/* Toggle Sidebar Button for Mobile/Tablet */}
        {(isMobile || !showSidebar) && (
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
          background: 'var(--surface)', 
          borderRight: '1px solid var(--border)',
          position: isMobile ? 'absolute' : 'relative',
          left: isMobile && !showSidebar ? '-300px' : '0',
          top: 0, bottom: 0,
          width: isMobile ? '280px' : 'auto',
          zIndex: 1050,
          transition: 'left 0.3s ease',
          boxShadow: isMobile && showSidebar ? '20px 0 50px rgba(0,0,0,0.5)' : 'none'
        }}>
          <SidebarContent stats={commandStats} activities={activities} conflicts={conflicts} onResolve={setShowResolveModal} settings={settings} />
        </aside>
        <div style={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
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

                {selectedLocal && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ 
                      padding: '0.6rem 1rem', borderRadius: '10px', 
                      background: 'rgba(59,130,246,0.15)', 
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
                {captures.filter(cap => !selectedLocal || cap.local_votacion === locales.find(l => l.cod_local === selectedLocal)?.nombre).map((cap) => (
                  <Marker key={`cap-${cap.id}`} position={[cap.lat, cap.lng]} icon={createCustomIcon(cap.traffic_light === 'GREEN' ? 'var(--green)' : cap.traffic_light === 'YELLOW' ? 'var(--yellow)' : 'var(--red)', 'MapPin', cap.needs_transport === 1)}>
                    <Popup>
                      <div style={{ padding: '0.5rem' }}>
                        <p style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{cap.nombre} {cap.apellido}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'var(--plra-500)', color: 'white' }}>
                            LISTA {cap.list_number}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>{cap.campaign_name}</span>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>Captado por: <strong>{cap.coordinator_name}</strong></p>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>Local: {cap.local_votacion}</p>
                        {cap.needs_transport === 1 && (
                          <div style={{ marginTop: '0.5rem', padding: '0.3rem', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', border: '1px solid var(--plra-300)', fontSize: '0.65rem', color: 'var(--plra-200)', fontWeight: 700, textAlign: 'center' }}>
                            🚗 REQUIERE TRASLADO
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
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
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>A Favor</p>
                      <p style={{ fontSize: '1.1rem', color: 'var(--green)', fontWeight: 900 }}>{commandStats?.green || 0}</p>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Progreso</p>
                      <p style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900 }}>{commandStats?.percentage || 0}%</p>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Conflictos</p>
                      <p style={{ fontSize: '1.1rem', color: conflicts.length > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 900 }}>{conflicts.length}</p>
                    </div>
                  </div>
                )}
              </MapContainer>
            </div>
          ) : activeTab === 'registry' ? (
            <div style={{ height: '100%', overflowY: 'auto', padding: '1.5rem', background: 'var(--surface-dark)' }}>
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="card-premium-styled" style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={18} style={{ color: 'var(--plra-300)' }} /> Búsqueda en el Padrón
                  </h2>
                  <div className="search-input-wrapper-premium">
                    <input 
                      type="text" 
                      className="modern-input-premium-styled" 
                      placeholder="Ingrese nombre, apellido o C.I..."
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                    {isSearching && (
                      <div className="loading-spinner-small" style={{ position: 'absolute', right: '1rem' }} />
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {searchResults.map((elector: any) => (
                    <div key={elector.ci} className="card-premium-styled" style={{ 
                      padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)'
                    }}>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '0.9rem' }}>{elector.nombre} {elector.apellido}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>C.I. {elector.ci}</p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-2)' }}>📍 {elector.local_votacion}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-2)' }}>🗳️ Mesa {elector.mesa}</span>
                        </div>
                      </div>
                      <button 
                        className="mini-action-btn"
                        onClick={() => {
                          if (elector.lat && elector.lng) {
                            setSelectedLocal(null); // Clear filter to see the specific point
                            setActiveTab('map');
                          } else {
                            alert('Este elector aún no ha sido captado geográficamente.');
                          }
                        }}
                      >
                        VER EN MAPA
                      </button>
                    </div>
                  ))}
                  {!isSearching && searchResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>Ingrese un criterio de búsqueda para localizar electores</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'requests' ? (
            <div style={{ padding: '2rem', height: '100%', overflowY: 'auto', background: 'var(--surface-dark)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Centro de Decisiones Estratégicas</h3>
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
                          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>Disputas Globales Detectadas</h3>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Electores captados por más de una lista simultáneamente.</p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {globalDisputes.map((d, i) => (
                          <div key={i} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239,68,68,0.1)' }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{d.nombre} {d.apellido}</p>
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
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>Solicitudes de Campo</h3>
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
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>Disputas Internas (Misma Lista)</h3>
                      </div>
                      {conflicts.map(conf => (
                        <div key={conf.id} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: '0.75rem' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem' }}>{conf.nombre} {conf.apellido}</p>
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
            <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto', background: 'var(--surface-dark)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>Padrón Electoral Inteligente</h3>
                <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                  {searchResults.length} registros cargados
                </div>
              </div>
              <ManagementTable 
                isLoading={isSearching}
                data={searchResults}
                columns={[
                  { header: 'CI', accessor: 'ci', width: '120px' },
                  { header: 'Nombre', accessor: (e: any) => `${e.nombre} ${e.apellido}` },
                  { header: 'Local', accessor: 'local_votacion' },
                  { header: 'Mesa', accessor: 'mesa', width: '80px' },
                  { 
                    header: 'Estado', 
                    accessor: (e: any) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          width: '8px', height: '8px', borderRadius: '50%', 
                          background: e.traffic_light === 'GREEN' ? 'var(--green)' : e.traffic_light === 'YELLOW' ? 'var(--yellow)' : e.traffic_light === 'RED' ? 'var(--red)' : 'var(--text-3)'
                        }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {e.traffic_light ? 'CAPTADO' : 'PENDIENTE'}
                        </span>
                      </div>
                    )
                  },
                  { header: 'Coordinador', accessor: 'coordinator_name' }
                ]}
              />
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
                  <p style={{ color: 'var(--text-2)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                    El elector <strong>{showResolveModal.elector_nombre} {showResolveModal.elector_apellido}</strong> ha sido captado por coordinadores de distintas listas.
                    <br/><br/>
                    Como Administrador, debes adjudicar oficialmente este elector a una de las campañas en disputa.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(59,130,246,0.05)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      Captura actual: <strong>{showResolveModal.coordinator_name}</strong>
                    </div>
                  </div>
                </div>

                <div className="modal-footer-premium-styled">
                  <button onClick={() => setShowResolveModal(null)} className="btn-cancel-styled">Descartar</button>
                  <button 
                    onClick={() => handleResolve(showResolveModal.capture_id)} 
                    className="btn-confirm-styled"
                  >
                    Confirmar Adjudicación <ChevronRight size={18} />
                  </button>
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
