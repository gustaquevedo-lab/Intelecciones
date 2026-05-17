import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Map, BarChart3, FileText, RefreshCw, Clock,
  CheckCircle2, AlertCircle, TrendingUp, Users, Award,
  Image, ChevronDown, ChevronUp, Zap, Shield, Truck, UserPlus,
  Plus, X
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api, { getImageUrl } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, CircleMarker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ImageCropperModal } from '../components/ImageCropperModal';

// ─── D'Hondt Algorithm ──────────────────────────────────────────────────────
const MapHandler = ({ activeDistrict, locales }: { activeDistrict?: string, locales?: any[] }) => {
  const map = useMap();
  const [lastDistrict, setLastDistrict] = useState<string | null>(null);

  useEffect(() => {
    if (activeDistrict && activeDistrict !== lastDistrict) {
      const city = activeDistrict.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const CIUDADES_PARAGUAY: Record<string, { lat: number; lng: number; zoom: number }> = {
        'PEDRO JUAN CABALLERO': { lat: -22.545, lng: -55.72, zoom: 14 },
        'ASUNCION': { lat: -25.2637, lng: -57.5759, zoom: 13 },
        'CIUDAD DEL ESTE': { lat: -25.5097, lng: -54.6111, zoom: 13 },
        'ENCARNACION': { lat: -27.3308, lng: -55.8667, zoom: 14 },
        'CONCEPCION': { lat: -23.4055, lng: -57.4340, zoom: 14 },
        'CAPITAN BADO': { lat: -23.2652, lng: -55.5323, zoom: 14 },
        'BELLA VISTA NORTE': { lat: -22.1287, lng: -56.5204, zoom: 14 },
        'ZANJA PYTA': { lat: -22.6186, lng: -55.6795, zoom: 14 },
        'KARAPAI': { lat: -23.4194, lng: -55.8458, zoom: 14 }
      };
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
          setLastDistrict(activeDistrict);
        }
      }
    }
  }, [map, activeDistrict, lastDistrict, locales]);
  return null;
};

function calcularDHondt(
  listas: { id: number; nombre: string; votos: number }[],
  bancas: number
): Record<number, number> {
  if (bancas <= 0 || listas.length === 0) return {};
  const cocientes: { id: number; cociente: number }[] = [];
  listas.forEach(l => {
    for (let d = 1; d <= bancas; d++) {
      cocientes.push({ id: l.id, cociente: l.votos / d });
    }
  });
  cocientes.sort((a, b) => b.cociente - a.cociente);
  const resultado: Record<number, number> = {};
  listas.forEach(l => (resultado[l.id] = 0));
  for (let i = 0; i < Math.min(bancas, cocientes.length); i++) {
    resultado[cocientes[i].id]++;
  }
  return resultado;
}

// ─── Colors ─────────────────────────────────────────────────────────────────
const LIST_COLORS = [
  '#2E84F0', '#25C882', '#F59E0B', '#A855F7',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316',
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const CoverageRing: React.FC<{ pct: number; reported: number; total: number }> = ({ pct, reported, total }) => {
  const r = 52; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <motion.circle
          cx="65" cy="65" r={r} fill="none"
          stroke={pct >= 80 ? '#25C882' : pct >= 40 ? '#F59E0B' : '#2E84F0'}
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - dash}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <text
          x="65" y="65" textAnchor="middle" dominantBaseline="central"
          style={{ fill: 'var(--text)', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Space Grotesk', transform: 'rotate(90deg)', transformOrigin: '65px 65px' }}
        >
          {pct.toFixed(0)}%
        </text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {reported} de {total} mesas
        </p>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; color?: string; sub?: string; icon?: React.ReactNode }> = ({
  label, value, color = 'var(--text)', sub, icon
}) => (
  <div style={{
    background: 'var(--surface-light)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.3rem'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {icon && <span style={{ color: 'var(--text-3)' }}>{icon}</span>}
      <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</span>
    </div>
    <span style={{ fontSize: '1.6rem', fontWeight: 800, color, fontFamily: 'Space Grotesk', lineHeight: 1 }}>{value}</span>
    {sub && <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{sub}</span>}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const DiaDApp: React.FC = () => {
  const { user, activeDistrict } = useAuth();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<'cobertura' | 'resultados' | 'dhondt' | 'actas' | 'miembros'>('cobertura');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false); // Desactivado por defecto hasta el Dia D

  // Data
  const [coverage, setCoverage] = useState({
    total_mesas: 0, 
    mesas_operativas: 0, op_porcentaje: 0,
    mesas_reportadas: 0, mesas_pendientes: 0,
    votos_procesados: 0, porcentaje: 0,
    total_coordinadores: 0, total_vehiculos: 0,
    mesas: [] as { id: number; numero: number; local: string; lat: number; lng: number; reportada: boolean; operativa: boolean }[]
  });
  const [locations, setLocations] = useState<any[]>([]);
  const [fleetLocations, setFleetLocations] = useState<any[]>([]);
  const [resultados, setResultados] = useState<{
    id: number; list_number: string; candidate_alias: string; type: string;
    votos: number; porcentaje: number;
  }[]>([]);
  const [actas, setActas] = useState<{
    id: number; mesa_numero: number; local: string; submitted_by: string;
    votos_total: number; foto_url: string | null; submitted_at: string;
  }[]>([]);
  const [bancasConcejal, setBancasConcejal] = useState(15);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<{local: string, numero: number} | null>(null);
  const [usersToAssign, setUsersToAssign] = useState<any[]>([]);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [expandedLocales, setExpandedLocales] = useState<Record<string, boolean>>({});
  const [showGlobalRegister, setShowGlobalRegister] = useState(false);
  const [globalRegCI, setGlobalRegCI] = useState('');
  const [globalRegData, setGlobalRegData] = useState<any>(null);
  const [globalRegLocal, setGlobalRegLocal] = useState('');
  const [globalRegMesa, setGlobalRegMesa] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [globalRegRole, setGlobalRegRole] = useState('VOCAL');
  const [membersList, setMembersList] = useState<any[]>([]);
  const [memberFilter, setMemberFilter] = useState('');
  const [selectedMesaForSwap, setSelectedMesaForSwap] = useState<{ local: string; numero: number } | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [newListNumber, setNewListNumber] = useState('');
  const [newListAlias, setNewListAlias] = useState('');
  const [newListType, setNewListType] = useState('CONCEJAL');
  const [newListCandidateCI, setNewListCandidateCI] = useState('');
  const [candidatePreview, setCandidatePreview] = useState<any>(null);
  const [isCandidateVerified, setIsCandidateVerified] = useState(false);
  const [newListOption, setNewListOption] = useState('');
  const [newListGoal, setNewListGoal] = useState(1000);
  const [takenOptions, setTakenOptions] = useState<number[]>([]);
  const [cropperData, setCropperData] = useState<{ image: string, type: string } | null>(null);
  const [expandedActa, setExpandedActa] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleLocal = (id: string) => {
    setExpandedLocales(prev => ({ ...prev, [id]: !prev[id] }));
  };


  const handleLookupGlobalCI = async () => {
    if (!globalRegCI) return;
    setIsVerifying(true);
    try {
      const res = await api.get(`/electors/${globalRegCI}`);
      if (res.data) {
        setGlobalRegData(res.data);
      } else {
        alert('Cédula no encontrada en el padrón nacional');
        setGlobalRegData(null);
      }
    } catch (err) { 
      console.error(err);
      alert('Error al consultar el padrón');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGlobalAssign = async () => {
    if (!globalRegData || !globalRegLocal || (!globalRegMesa && globalRegRole !== 'APODERADO')) {
      alert('Por favor complete todos los campos (CI, Local y Mesa)');
      return;
    }
    setAssigningLoading(true);
    try {
      await api.post('/diad/members/assign', {
        ci: globalRegCI,
        local: globalRegLocal,
        mesa: globalRegMesa,
        role: globalRegRole
      });
      setShowGlobalRegister(false);
      setGlobalRegCI('');
      setGlobalRegData(null);
      setGlobalRegLocal('');
      setGlobalRegMesa(null);
      setGlobalRegRole('VOCAL');
      fetchData();
      alert('Miembro asignado correctamente');
    } catch (err) {
      console.error(err);
      alert('Error al realizar la asignación');
    } finally {
      setAssigningLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListNumber || !newListAlias) return;
    try {
      await api.post('/diad/listas', {
        list_number: newListNumber,
        candidate_alias: newListAlias,
        candidate_ci: newListCandidateCI,
        type: newListType,
        option_number: newListOption,
        goal: newListGoal,
        is_adversary: true,
        photo_url: candidatePreview?.photo_url
      });
      setShowListModal(false);
      setNewListNumber('');
      setNewListAlias('');
      setNewListCandidateCI('');
      setNewListOption('');
      setCandidatePreview(null);
      setIsCandidateVerified(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (newListNumber && newListType === 'CONCEJAL') {
      const options = resultados
        .filter(r => r.list_number === newListNumber && r.type === 'CONCEJAL')
        .map(r => parseInt((r as any).option_number || '0'))
        .filter(n => n > 0);
      setTakenOptions(options);
    } else {
      setTakenOptions([]);
    }
  }, [newListNumber, newListType, resultados]);

  const handleLookupCandidate = async () => {
    if (!newListCandidateCI) return;
    try {
      const res = await api.get(`/admin/verify-candidate/${newListCandidateCI}`);
      if (res.data) {
        setCandidatePreview(res.data);
        setIsCandidateVerified(true);
        if (!newListAlias) setNewListAlias(`${res.data.nombre} ${res.data.apellido}`);
      }
    } catch (err) { 
      alert('C.I. no encontrado en el padrón'); 
      setIsCandidateVerified(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setCropperData({ image: reader.result as string, type });
      e.target.value = '';
    };
  };

  const onCropComplete = async (croppedBlob: Blob) => {
    if (!cropperData) return;
    const { type } = cropperData;
    setCropperData(null);
    try {
      const formData = new FormData();
      formData.append('photo', croppedBlob, 'photo.jpg');
      const res = await api.post('/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (type === 'list') {
        setCandidatePreview(prev => ({ ...(prev || {}), photo_url: res.data.photo_url }));
      }
    } catch (err) { console.error('Error uploading cropped image:', err); }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      // Only users that can be members
      setUsersToAssign(res.data.filter((u: any) => ['COORDINADOR', 'VEEDOR', 'MIEMBRO_MESA'].includes(u.role)));
    } catch (err) { console.error(err); }
  };

  const fetchData = useCallback(async () => {
    try {
      const [covRes, resRes, actasRes, locRes, fleetRes, memRes] = await Promise.all([
        api.get('/diad/coverage').catch(() => ({ data: null })),
        api.get('/diad/results').catch(() => ({ data: null })),
        api.get('/diad/actas').catch(() => ({ data: null })),
        api.get('/voting-locations').catch(() => ({ data: [] })),
        api.get('/logistics/clusters').catch(() => ({ data: [] })),
        api.get('/diad/members').catch(() => ({ data: [] }))
      ]);
      if (covRes.data) setCoverage(covRes.data);
      if (resRes.data) setResultados(resRes.data);
      if (actasRes.data) setActas(actasRes.data);
      if (locRes.data) setLocations(locRes.data);
      if (fleetRes.data) setFleetLocations(fleetRes.data);
      if (memRes.data) setMembersList(memRes.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('DiaDApp fetch error:', err);
    }
  }, []);

  useEffect(() => {
    const isElectionDay = true; // Relaxed for testing or pre-election day monitoring
    if (isElectionDay) {
      fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    // Solo activamos el polling si es el día de la elección (07/06/2026) o si el usuario lo activa manualmente
    const isElectionDay = true; // Relaxed for testing or pre-election day monitoring
    
    if (!autoRefresh || !isElectionDay) return;
    
    // Polling cada 60 segundos para no saturar móviles y ahorrar batería
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // D'Hondt data memoized for performance
  const concejales = resultados.filter(r => r.type === 'CONCEJAL');
  const intendentes = resultados.filter(r => r.type === 'INTENDENTE');
  const dhondtResult = React.useMemo(() => {
    const dhondtInput = concejales.map(r => ({ id: r.id, nombre: r.candidate_alias || r.list_number, votos: r.votos }));
    return calcularDHondt(dhondtInput, bancasConcejal);
  }, [concejales, bancasConcejal]);
  const maxVotos = Math.max(...resultados.map(r => r.votos || 0), 1);

  const TABS = [
    { id: 'cobertura', label: 'Cobertura', icon: <Activity size={14} /> },
    { id: 'miembros', label: 'Staff Mesas', icon: <Users size={14} /> },
    { id: 'resultados', label: 'Resultados', icon: <BarChart3 size={14} /> },
    { id: 'dhondt', label: "D'Hondt", icon: <Award size={14} /> },
    { id: 'actas', label: 'Actas', icon: <FileText size={14} /> },
  ] as const;

  return (
    <MainLayout title="Día D — Centro de Resultados" userName={user?.nombre || ''} userPhoto={getImageUrl(user?.photo_url) || ''}>
      
      {/* ── Standby Banner ── */}
      {false && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          padding: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          color: '#F59E0B'
        }}>
          <Clock size={14} />
          <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Módulo en modo espera — Activo el 07/06/2026 (Día de la Elección)
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 102px)', overflow: 'hidden' }}>

        {/* ── Top control bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.65rem 1.25rem', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap', gap: '0.5rem'
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '10px', gap: '2px' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none',
                  background: activeTab === t.id ? 'linear-gradient(135deg,#1558B0,#0D3D7A)' : 'transparent',
                  color: activeTab === t.id ? 'white' : 'var(--text-3)',
                  fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: activeTab === t.id ? '0 2px 8px rgba(21,88,176,0.4)' : 'none'
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>
              Actualizado: {lastRefresh.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={() => setAutoRefresh(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid',
                background: autoRefresh ? 'rgba(37,200,130,0.1)' : 'rgba(255,255,255,0.04)',
                borderColor: autoRefresh ? 'rgba(37,200,130,0.3)' : 'rgba(255,255,255,0.1)',
                color: autoRefresh ? 'var(--green)' : 'var(--text-3)',
                fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer'
              }}
            >
              <Zap size={11} /> {autoRefresh ? 'AUTO' : 'MANUAL'}
            </button>
            <button
              onClick={fetchData}
              style={{
                padding: '0.3rem 0.65rem', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-3)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.65rem', fontWeight: 700
              }}
            >
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
          <AnimatePresence mode="wait">

            {/* ══════════ TAB: COBERTURA ══════════ */}
            {activeTab === 'cobertura' && (
              <motion.div key="cobertura" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '1.5rem' }}>
                  {/* Operational Ring */}
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '16px', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <p style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--plra-300)', marginBottom: '0.25rem' }}>
                      Operativa: Miembros de Mesa
                    </p>
                    <CoverageRing
                      pct={coverage.op_porcentaje}
                      reported={coverage.mesas_operativas}
                      total={coverage.total_mesas}
                    />
                    <div style={{
                      display: 'flex', gap: '0.5rem', marginTop: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.6rem', color: 'var(--blue-lt)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Users size={10} /> {coverage.mesas_operativas} cubiertas
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertCircle size={10} /> {coverage.total_mesas - coverage.mesas_operativas} sin miembro
                      </span>
                    </div>
                  </div>

                  {/* KPIs Operativos */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                    <StatCard
                      label="Total Mesas"
                      value={coverage.total_mesas}
                      color="var(--text)"
                      icon={<Activity size={12} />}
                    />
                    <StatCard
                      label="Mesas Cubiertas"
                      value={coverage.mesas_operativas}
                      color="var(--blue-lt)"
                      icon={<Users size={12} />}
                    />
                    <StatCard
                      label="Cobertura Operativa"
                      value={`${coverage.op_porcentaje.toFixed(1)}%`}
                      color={coverage.op_porcentaje >= 90 ? 'var(--green)' : coverage.op_porcentaje >= 50 ? '#F59E0B' : 'var(--red)'}
                      sub="Disponibilidad de personal"
                      icon={<TrendingUp size={12} />}
                    />
                    <StatCard
                      label="Coordinadores"
                      value={coverage.total_coordinadores}
                      color="var(--blue-lt)"
                      icon={<Users size={12} />}
                      sub="En campo"
                    />
                    <StatCard
                      label="Móviles Activos"
                      value={coverage.total_vehiculos}
                      color="var(--plra-300)"
                      icon={<Truck size={12} />}
                      sub="Flota logística"
                    />
                    
                    {/* Territorial Distribution - Main View */}
                    <div className="card-premium-styled" style={{ gridColumn: 'span 3', padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.85rem', marginBottom: '1.25rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                        <Map size={16} style={{ color: 'var(--blue-lt)' }} /> Distribución Territorial & Presencia
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {locations.map(loc => {
                          const mesasInLoc = coverage.mesas.filter(m => m.local === loc.nombre);
                          const assignedInLoc = mesasInLoc.filter(m => m.operativa).length;
                          const pct = mesasInLoc.length > 0 ? (assignedInLoc / mesasInLoc.length) * 100 : 0;
                          const isExpanded = !!expandedLocales[loc.cod_local];

                          return (
                            <div key={loc.cod_local} style={{ 
                              padding: '1rem', background: 'var(--surface-light)', borderRadius: '12px',
                              border: `1px solid ${pct >= 100 ? 'rgba(37,200,130,0.3)' : 'var(--border)'}`,
                              display: 'flex', flexDirection: 'column', gap: '0.75rem',
                              transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', display: 'block', lineHeight: 1.2 }}>{loc.nombre}</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{mesasInLoc.length} Mesas totales</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: pct >= 100 ? 'var(--green)' : pct > 0 ? '#F59E0B' : 'var(--red)', display: 'block' }}>{assignedInLoc}</span>
                                  <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Presencia</span>
                                </div>
                              </div>
                              
                              <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  style={{ height: '100%', background: pct >= 100 ? 'var(--green)' : pct > 0 ? '#F59E0B' : 'var(--red)' }}
                                />
                              </div>

                              <button 
                                onClick={() => toggleLocal(loc.cod_local)}
                                style={{ 
                                  width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)',
                                  background: 'rgba(255,255,255,0.02)', color: 'var(--text-2)', fontSize: '0.65rem', fontWeight: 700,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                                }}
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {isExpanded ? 'CERRAR DETALLE' : 'GESTIONAR MESAS'}
                              </button>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{ overflow: 'hidden', marginTop: '0.5rem' }}
                                  >
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                                      {mesasInLoc.map(m => (
                                        <button
                                          key={`${m.local}-${m.numero}`}
                                          onClick={() => { setSelectedMesa({local: m.local, numero: m.numero}); setShowAssignModal(true); fetchUsers(); }}
                                          style={{
                                            padding: '0.4rem 0.2rem', borderRadius: '6px', border: '1px solid',
                                            background: m.operativa ? 'rgba(37,200,130,0.1)' : 'rgba(239,68,68,0.05)',
                                            borderColor: m.operativa ? 'rgba(37,200,130,0.2)' : 'rgba(239,68,68,0.1)',
                                            color: m.operativa ? 'var(--green)' : 'var(--text-3)',
                                            fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer'
                                          }}
                                        >
                                          M{m.numero}
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Map */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '14px', overflow: 'hidden', height: '450px'
                }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Map size={14} style={{ color: 'var(--plra-300)' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Mapa de Cobertura
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                      {[
                        { color: 'var(--blue-lt)', label: 'Con Miembro' },
                        { color: 'var(--red)', label: 'Sin Miembro' },
                      ].map(l => (
                        <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', color: 'var(--text-3)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <MapContainer
                    center={[-22.5447, -55.7333]}
                    zoom={13}
                    style={{ height: 'calc(100% - 42px)', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap'
                    />
                    <ZoomControl position="bottomright" />
                    <MapHandler activeDistrict={activeDistrict || user?.distrito} locales={locations} />
                    
                    {/* Voting Locations Pins */}
                    {locations.map(loc => (
                      <CircleMarker
                        key={`loc-${loc.id}`}
                        center={[loc.lat || -22.5447, loc.lng || -55.7333]}
                        radius={6}
                        pathOptions={{
                          color: 'var(--plra-500)',
                          fillColor: 'var(--plra-300)',
                          fillOpacity: 0.8,
                          weight: 2
                        }}
                      >
                        <Popup>
                          <strong>Local: {loc.nombre}</strong><br />
                          <div style={{ color: 'var(--text)', padding: '0.2rem' }}>
                            <p style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{loc.nombre}</p>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Local de Votación</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}

                    {/* Fleet Heatmap / Clusters */}
                    {fleetLocations.map((fleet, idx) => (
                      <CircleMarker
                        key={`fleet-${idx}`}
                        center={[fleet.lat, fleet.lng]}
                        radius={Math.min(20, 8 + fleet.count * 2)}
                        pathOptions={{
                          color: 'transparent',
                          fillColor: 'var(--red)',
                          fillOpacity: 0.3,
                        }}
                      />
                    ))}

                    {/* Mesas (Operational Status) */}
                    <MarkerClusterGroup>
                      {coverage.mesas.map(mesa => (
                        <Marker 
                          key={`mesa-${mesa.local}-${mesa.numero}`}
                          position={[
                            typeof mesa.lat === 'string' ? parseFloat(mesa.lat) : (mesa.lat || -22.5447), 
                            typeof mesa.lng === 'string' ? parseFloat(mesa.lng) : (mesa.lng || -55.7333)
                          ]}
                          icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `
                              <div style="
                                width: 14px; height: 14px; 
                                background: ${mesa.operativa ? 'var(--blue-lt)' : 'var(--red)'}; 
                                border: 2px solid white; 
                                border-radius: 50%; 
                                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                              "></div>
                            `,
                            iconSize: [14, 14],
                            iconAnchor: [7, 7]
                          })}
                        >
                          <Popup>
                            <div style={{ color: 'var(--text)', padding: '0.2rem' }}>
                              <p style={{ fontWeight: 800, fontSize: '0.85rem' }}>{mesa.local}</p>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>MESA {mesa.numero}</p>
                              <p style={{ 
                                fontSize: '0.65rem', color: mesa.operativa ? 'var(--green)' : 'var(--red)',
                                fontWeight: 800, marginTop: '0.4rem', textTransform: 'uppercase'
                              }}>
                                {mesa.operativa ? '● OPERATIVA (MIEMBRO ASIGNADO)' : '○ PENDIENTE DE MIEMBRO'}
                              </p>
                              {!mesa.operativa && (
                                <button 
                                  onClick={() => { setSelectedMesa({local: mesa.local, numero: mesa.numero}); setShowAssignModal(true); fetchUsers(); }}
                                  style={{
                                    marginTop: '0.6rem', padding: '0.4rem 0.8rem', width: '100%',
                                    background: 'var(--red)', color: 'white', border: 'none',
                                    borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                                  }}
                                >
                                  ASIGNAR AHORA
                                </button>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MarkerClusterGroup>
                  </MapContainer>
                </div>
              </motion.div>
            )}

            {/* ══════════ TAB: RESULTADOS ══════════ */}
            {activeTab === 'resultados' && (
              <motion.div key="resultados" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                
                {/* Results Coverage Header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '2rem' }}>
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '16px', padding: '1.2rem 1.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem'
                  }}>
                    <p style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.2rem' }}>
                      Escrutinio de Mesas
                    </p>
                    <CoverageRing
                      pct={coverage.porcentaje}
                      reported={coverage.mesas_reportadas}
                      total={coverage.total_mesas}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                    <StatCard
                      label="Campaña Activa"
                      value={settings.app_name || 'PLRA 2026'}
                      color="var(--blue-lt)"
                      icon={<Shield size={12} />}
                      sub={settings.campaign_slogan}
                    />
                    <StatCard
                      label="Votos Contabilizados"
                      value={coverage.votos_procesados.toLocaleString('es-PY')}
                      color="var(--green)"
                      icon={<Users size={12} />}
                    />
                    <StatCard
                      label="Estado de Carga"
                      value={coverage.porcentaje >= 100 ? '✓ COMPLETO' : '● EN VIVO'}
                      color={coverage.porcentaje >= 100 ? 'var(--green)' : '#F59E0B'}
                      sub={`${coverage.mesas_reportadas} de ${coverage.total_mesas} mesas`}
                    />
                  </div>
                </div>

                {/* Intendente */}
                {intendentes.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <div style={{ width: 4, height: 18, background: 'var(--blue)', borderRadius: 2 }} />
                      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        Intendente Municipal
                      </h3>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>— mayoría simple</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {[...intendentes].sort((a, b) => b.votos - a.votos).map((r, i) => {
                        const pct = maxVotos > 0 ? (r.votos / maxVotos) * 100 : 0;
                        const isWinning = i === 0 && r.votos > 0;
                        return (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            style={{
                              background: isWinning ? 'rgba(37,200,130,0.06)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isWinning ? 'rgba(37,200,130,0.2)' : 'rgba(255,255,255,0.06)'}`,
                              borderRadius: '12px', padding: '0.9rem 1.1rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-3)', width: 20 }}>#{i + 1}</span>
                              <span style={{ flex: 1, fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                                {r.candidate_alias || r.list_number}
                              </span>
                              {isWinning && (
                                <span style={{ background: 'rgba(37,200,130,0.15)', border: '1px solid rgba(37,200,130,0.3)', color: 'var(--green)', fontSize: '0.55rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '6px', letterSpacing: '0.1em' }}>
                                  ▲ GANANDO
                                </span>
                              )}
                              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>
                                {(r.votos || 0).toLocaleString('es-PY')}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', width: 44, textAlign: 'right' }}>
                                {(r.porcentaje || 0).toFixed(1)}%
                              </span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                style={{ height: '100%', background: isWinning ? 'linear-gradient(90deg,#25C882,#169058)' : 'linear-gradient(90deg,#2E84F0,#1558B0)', borderRadius: 3 }}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Concejales */}
                {concejales.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <div style={{ width: 4, height: 18, background: 'var(--green)', borderRadius: 2 }} />
                      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        Concejales Municipales
                      </h3>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>— sistema D'Hondt</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {[...concejales].sort((a, b) => b.votos - a.votos).map((r, i) => {
                        const maxC = Math.max(...concejales.map(x => x.votos), 1);
                        const pct = (r.votos / maxC) * 100;
                        const color = LIST_COLORS[i % LIST_COLORS.length];
                        return (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '12px', padding: '0.8rem 1rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <span style={{ flex: 1, fontWeight: 700, color: 'var(--text)', fontSize: '0.85rem' }}>
                                {r.list_number} — {r.candidate_alias || ''}
                              </span>
                              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                                {(r.votos || 0).toLocaleString('es-PY')}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', width: 44, textAlign: 'right' }}>
                                {(r.porcentaje || 0).toFixed(1)}%
                              </span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                style={{ height: '100%', background: color, borderRadius: 2 }}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {resultados.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-3)' }}>
                    <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 700 }}>Sin resultados cargados aún</p>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>Los veedores deben cargar las actas de mesa para visualizar resultados.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ══════════ TAB: D'HONDT ══════════ */}
            {activeTab === 'dhondt' && (
              <motion.div key="dhondt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>
                      Proyección D'Hondt — Concejales
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                      Asignación proporcional de bancas basada en votos procesados ({coverage.porcentaje.toFixed(0)}% de cobertura)
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button 
                      onClick={() => setShowListModal(true)}
                      className="btn-cancel-styled"
                      style={{ fontSize: '0.65rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Plus size={12} /> Gestionar Listas
                    </button>
                    <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 700 }}>Bancas:</label>
                    <input
                      type="number"
                      value={bancasConcejal}
                      onChange={e => setBancasConcejal(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      style={{
                        width: 50, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px', color: 'var(--text)', padding: '0.3rem 0.5rem',
                        fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '0.9rem', textAlign: 'center'
                      }}
                    />
                  </div>
                </div>

                {concejales.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      {[...concejales]
                        .sort((a, b) => (dhondtResult[b.id] || 0) - (dhondtResult[a.id] || 0))
                        .map((r, i) => {
                          const bancas = dhondtResult[r.id] || 0;
                          const color = LIST_COLORS[i % LIST_COLORS.length];
                          return (
                            <motion.div
                              key={r.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.04 }}
                              style={{
                                background: bancas > 0 ? `${color}14` : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${bancas > 0 ? color + '40' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: '14px', padding: '1.1rem',
                                display: 'flex', flexDirection: 'column', gap: '0.4rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)' }}>
                                  {r.list_number}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                                {r.candidate_alias || 'Lista ' + r.list_number}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginTop: '0.2rem' }}>
                                <span style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'Space Grotesk', color: bancas > 0 ? color : 'var(--text-3)', lineHeight: 1 }}>
                                  {bancas}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>
                                  banca{bancas !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                                {(r.votos || 0).toLocaleString('es-PY')} votos · {(r.porcentaje || 0).toFixed(1)}%
                              </span>
                            </motion.div>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-3)' }}>
                    <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 700 }}>Sin resultados cargados aún</p>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>Los veedores deben cargar las actas de mesa para visualizar resultados.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'miembros' && (
              <motion.div key="miembros" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* Visual Header Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <StatCard 
                    label="Mesas Totales" 
                    value={coverage.total_mesas} 
                    color="var(--text)"
                    icon={<Activity size={12} />} 
                  />
                  <StatCard 
                    label="Mesas Constituidas" 
                    value={membersList.filter(m => m.role !== 'APODERADO' && m.assigned_local && m.assigned_local !== 'SIN ASIGNACIÓN').length} 
                    color="var(--green)"
                    icon={<CheckCircle2 size={12} />} 
                  />
                  <StatCard 
                    label="Mesas Vacantes" 
                    value={Math.max(0, coverage.total_mesas - membersList.filter(m => m.role !== 'APODERADO' && m.assigned_local && m.assigned_local !== 'SIN ASIGNACIÓN').length)} 
                    color="var(--red)"
                    icon={<AlertCircle size={12} />} 
                  />
                  <StatCard 
                    label="Suplentes en Reserva" 
                    value={membersList.filter(m => m.role !== 'APODERADO' && (!m.assigned_local || m.assigned_local === 'SIN ASIGNACIÓN' || m.assigned_local === '---')).length} 
                    color="var(--plra-300)"
                    icon={<Users size={12} />} 
                  />
                </div>

                {/* Subheader Title & Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Constitución de Mesas de Votación
                    </h3>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                      Asigne mesarios titulares y swaps rápidos con suplentes precargados del PLRA.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button 
                      onClick={() => setShowGlobalRegister(true)}
                      className="action-btn-primary" 
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <UserPlus size={14} /> REGISTRAR PERSONAL
                    </button>
                  </div>
                </div>

                {/* Dual-Pane Workbench Layout */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start', width: '100%' }}>
                  
                  {/* Left Panel (2/3 width) - Grid of Mesas grouped by Voting Location */}
                  <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {locations.map(loc => {
                      const mesasInLoc = coverage.mesas.filter(m => m.local === loc.nombre);
                      if (mesasInLoc.length === 0) return null;

                      return (
                        <div key={loc.cod_local} className="card-premium-styled" style={{ padding: '1.25rem' }}>
                          {/* Location Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.50rem' }}>
                            <MapPin size={16} style={{ color: 'var(--plra-300)' }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>{loc.nombre}</span>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)', padding: '2px 8px', borderRadius: '10px', marginLeft: 'auto', fontWeight: 700 }}>
                              {mesasInLoc.length} MESAS
                            </span>
                          </div>

                          {/* Mesas Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.8rem' }}>
                            {mesasInLoc.map(mesa => {
                              const assignedMember = membersList.find(m => m.assigned_local === loc.nombre && m.assigned_mesa === mesa.numero);
                              const isConstituida = !!assignedMember;
                              const isSelectedForSwap = selectedMesaForSwap?.local === loc.nombre && selectedMesaForSwap?.numero === mesa.numero;

                              return (
                                <div 
                                  key={`${loc.cod_local}-mesa-${mesa.numero}`}
                                  style={{
                                    padding: '1rem',
                                    background: isSelectedForSwap ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                                    border: isSelectedForSwap 
                                      ? '2px solid var(--green)' 
                                      : `1px solid ${isConstituida ? 'rgba(37,200,130,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                    borderRadius: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.6rem',
                                    boxShadow: isSelectedForSwap ? '0 0 15px rgba(34,197,94,0.15)' : 'none',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                  }}
                                >
                                  {/* Table Card Header */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                      MESA {mesa.numero}
                                    </span>
                                    <span style={{ 
                                      padding: '2px 6px', borderRadius: '6px', fontSize: '0.55rem', fontWeight: 800,
                                      background: isConstituida ? 'rgba(37,200,130,0.1)' : 'rgba(239,68,68,0.1)',
                                      color: isConstituida ? 'var(--green)' : 'var(--red)',
                                      border: `1px solid ${isConstituida ? 'rgba(37,200,130,0.2)' : 'rgba(239,68,68,0.2)'}`
                                    }}>
                                      {isConstituida ? '● CONSTITUIDA' : '○ VACANTE'}
                                    </span>
                                  </div>

                                  {/* Table Card Body / Assigned Mesario */}
                                  {isConstituida ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                                        {assignedMember.nombre}
                                      </span>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                                          CI: {assignedMember.ci || '—'} · <span style={{ color: 'var(--plra-300)', fontWeight: 800 }}>{assignedMember.role}</span>
                                        </span>
                                      </div>
                                      
                                      {/* WhatsApp / Tel direct links */}
                                      {assignedMember.telefono && (
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                                          <a 
                                            href={`tel:${assignedMember.telefono}`}
                                            style={{
                                              padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)',
                                              background: 'rgba(255,255,255,0.03)', color: 'var(--text-2)', fontSize: '0.6rem',
                                              fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem'
                                            }}
                                          >
                                            📞 Llamar
                                          </a>
                                          <a 
                                            href={`https://wa.me/595${assignedMember.telefono.replace(/\s+/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.2)',
                                              background: 'rgba(34,197,94,0.05)', color: '#4ADE80', fontSize: '0.6rem',
                                              fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem'
                                            }}
                                          >
                                            💬 WhatsApp
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ padding: '0.4rem 0', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                                        Sin mesario principal asignado.
                                      </span>
                                      <span style={{ fontSize: '0.62rem', color: 'var(--red)', fontWeight: 700 }}>
                                        ⚠️ Reporte ausente en apertura.
                                      </span>
                                    </div>
                                  )}

                                  {/* Card Quick Actions */}
                                  <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                                    {isConstituida ? (
                                      <>
                                        <button
                                          onClick={() => setSelectedMesaForSwap({ local: loc.nombre, numero: mesa.numero })}
                                          style={{
                                            flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)',
                                            background: 'rgba(255,255,255,0.02)', color: 'var(--text-2)', fontSize: '0.65rem',
                                            fontWeight: 800, cursor: 'pointer'
                                          }}
                                        >
                                          REEMPLAZAR
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (!confirm(`¿Liberar a ${assignedMember.nombre} de la Mesa ${mesa.numero}?`)) return;
                                            try {
                                              await api.post('/diad/members/assign', { user_id: assignedMember.id, local: null, mesa: null });
                                              fetchData();
                                            } catch (e) { console.error(e); }
                                          }}
                                          style={{
                                            padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.15)',
                                            background: 'rgba(239,68,68,0.05)', color: 'var(--red)', fontSize: '0.65rem',
                                            fontWeight: 800, cursor: 'pointer'
                                          }}
                                        >
                                          LIBERAR
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => setSelectedMesaForSwap({ local: loc.nombre, numero: mesa.numero })}
                                        style={{
                                          width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--green)',
                                          background: isSelectedForSwap ? 'var(--green)' : 'rgba(34,197,94,0.1)',
                                          color: isSelectedForSwap ? 'white' : '#4ADE80', fontSize: '#4ADE80',
                                          fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer',
                                          animation: !isConstituida && !isSelectedForSwap ? 'pulseBorder 2s infinite' : 'none'
                                        }}
                                      >
                                        {isSelectedForSwap ? 'SELECCIONANDO SUPLENTE...' : '🟢 ASIGNAR SUPLENTE'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Panel (1/3 width) - Sticky Standby Pool (Banco de Suplentes) */}
                  <div style={{ 
                    flex: '1', 
                    maxWidth: '360px',
                    background: 'var(--surface-light)',
                    border: selectedMesaForSwap ? '2px dashed var(--green)' : '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    position: 'sticky',
                    top: '20px',
                    boxShadow: selectedMesaForSwap ? '0 0 25px rgba(34,197,94,0.12)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    {/* Panel Title */}
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Users size={16} style={{ color: 'var(--plra-300)' }} /> Banco de Suplentes
                      </h4>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
                        Personal libre listo para reasignar.
                      </p>
                    </div>

                    {/* Active Swap Alert Indicator */}
                    {selectedMesaForSwap && (
                      <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{
                          padding: '0.75rem', background: 'rgba(34,197,94,0.1)', border: '1px solid var(--green)',
                          borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.2rem'
                        }}
                      >
                        <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#4ADE80', textTransform: 'uppercase' }}>
                          👉 Asignando a Mesa
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white' }}>
                          MESA {selectedMesaForSwap.numero} ({selectedMesaForSwap.local})
                        </span>
                        <button 
                          onClick={() => setSelectedMesaForSwap(null)}
                          style={{
                            alignSelf: 'flex-start', background: 'transparent', border: 'none',
                            color: 'var(--text-3)', fontSize: '0.6rem', fontWeight: 700, padding: 0,
                            marginTop: '0.2rem', cursor: 'pointer', textDecoration: 'underline'
                          }}
                        >
                          Cancelar Swap
                        </button>
                      </motion.div>
                    )}

                    {/* Standby Search */}
                    <div className="search-input-wrapper-premium" style={{ width: '100%' }}>
                      <input 
                        className="modern-input-premium-styled" 
                        placeholder="Buscar suplente..."
                        value={memberFilter}
                        onChange={e => setMemberFilter(e.target.value)}
                        style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                      />
                    </div>

                    {/* Substitutes List */}
                    <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '2px' }}>
                      {(() => {
                        const standby = membersList.filter(m => m.role !== 'APODERADO' && (!m.assigned_local || m.assigned_local === 'SIN ASIGNACIÓN' || m.assigned_local === '---'));
                        const filtered = standby.filter(m => !memberFilter || m.nombre.toLowerCase().includes(memberFilter.toLowerCase()) || m.ci?.includes(memberFilter));

                        if (filtered.length === 0) {
                          return (
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center', padding: '2rem' }}>
                              No hay suplentes disponibles.
                            </p>
                          );
                        }

                        return filtered.map(m => (
                          <div 
                            key={m.id}
                            style={{
                              padding: '0.85rem',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border)',
                              borderRadius: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', display: 'block' }}>{m.nombre}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>CI: {m.ci || '—'}</span>
                              </div>
                              <span style={{ 
                                padding: '1px 5px', borderRadius: '4px', fontSize: '0.5rem', fontWeight: 800,
                                background: m.role === 'VEEDOR' ? 'rgba(168,85,247,0.1)' : 'rgba(37,200,130,0.1)',
                                color: m.role === 'VEEDOR' ? '#A855F7' : '#25C882',
                                border: `1px solid ${m.role === 'VEEDOR' ? 'rgba(168,85,247,0.2)' : 'rgba(37,200,130,0.2)'}`
                              }}>
                                {m.role}
                              </span>
                            </div>

                            {/* Contact Details inside Standby Card */}
                            {m.telefono && (
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem' }}>
                                <a 
                                  href={`tel:${m.telefono}`}
                                  style={{ fontSize: '0.6rem', color: 'var(--text-3)', textDecoration: 'none' }}
                                >
                                  📞 {m.telefono}
                                </a>
                              </div>
                            )}

                            {/* Direct Assignment swap trigger */}
                            {selectedMesaForSwap ? (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={async () => {
                                  setAssigningLoading(true);
                                  try {
                                    await api.post('/diad/members/assign', { 
                                      user_id: m.id, 
                                      local: selectedMesaForSwap.local, 
                                      mesa: selectedMesaForSwap.numero,
                                      role: m.role
                                    });
                                    setSelectedMesaForSwap(null);
                                    fetchData();
                                  } catch (e) { console.error(e); }
                                  finally { setAssigningLoading(false); }
                                }}
                                style={{
                                  width: '100%', padding: '0.45rem', borderRadius: '6px', border: 'none',
                                  background: 'linear-gradient(135deg, #22C47E, #16a34a)', color: 'white',
                                  fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', marginTop: '0.2rem',
                                  boxShadow: '0 4px 10px rgba(34,197,94,0.25)'
                                }}
                              >
                                🟢 UBICAR EN MESA {selectedMesaForSwap.numero}
                              </motion.button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedMesa({ local: 'SIN ASIGNACIÓN', numero: 0 });
                                  setSelectedMesa({ local: '', numero: m.assigned_mesa || 0 });
                                  setSelectedMesa({ local: locations[0]?.nombre || '', numero: 1 });
                                  setSelectedMesa({ local: 'BANCO_SUPLENTES', numero: m.id }); // Helper fallback standard trigger
                                  setShowAssignModal(true);
                                  fetchUsers();
                                }}
                                style={{
                                  width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)',
                                  background: 'rgba(255,255,255,0.03)', color: 'var(--text-2)', fontSize: '0.62rem',
                                  fontWeight: 800, cursor: 'pointer', marginTop: '0.2rem'
                                }}
                              >
                                ASIGNAR A...
                              </button>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {activeTab === 'actas' && (
              <motion.div key="actas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>
                    Actas recibidas
                    <span style={{
                      marginLeft: '0.6rem', background: 'rgba(37,200,130,0.12)',
                      border: '1px solid rgba(37,200,130,0.25)', color: 'var(--green)',
                      fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '100px'
                    }}>
                      {actas.length}
                    </span>
                  </h3>
                </div>

                {actas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-3)' }}>
                    <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 700 }}>Sin actas cargadas</p>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>Los veedores envían las actas desde su app una vez cierran las urnas.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {actas.map(acta => (
                      <div
                        key={acta.id}
                        style={{
                          background: 'var(--surface-light)', border: '1px solid var(--border)',
                          borderRadius: '12px', overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', cursor: 'pointer' }}
                          onClick={() => setExpandedActa(expandedActa === acta.id ? null : acta.id)}
                        >
                          <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.85rem' }}>
                              Mesa {acta.mesa_numero}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginLeft: '0.5rem' }}>
                              {acta.local}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>
                            {acta.votos_total.toLocaleString('es-PY')} votos
                          </span>
                          {acta.foto_url && <Image size={13} style={{ color: 'var(--blue-lt)' }} />}
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                            {new Date(acta.submitted_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {expandedActa === acta.id ? <ChevronUp size={14} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />}
                        </div>

                        <AnimatePresence>
                          {expandedActa === acta.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              style={{ overflow: 'hidden', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
                            >
                              <div style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                    Datos del acta
                                  </p>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>Cargado por: <strong>{acta.submitted_by}</strong></p>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>Total votos emitidos: <strong>{acta.votos_total}</strong></p>
                                </div>
                                {acta.foto_url && (
                                  <div>
                                    <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                      Foto del acta
                                    </p>
                                    <img
                                      src={acta.foto_url}
                                      alt={`Acta Mesa ${acta.mesa_numero}`}
                                      style={{ maxWidth: 200, maxHeight: 150, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                      onClick={() => window.open(acta.foto_url!, '_blank')}
                                    />
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* --- LIST MANAGEMENT MODAL --- */}
      <AnimatePresence>
        {showListModal && (
          <div 
            className="modal-overlay" 
            onClick={(e) => { if (e.target === e.currentTarget) setShowListModal(false); }}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '500px', width: '100%', padding: 0, overflowY: 'auto', maxHeight: '90vh', position: 'relative' }}
            >
              <div style={{ 
                padding: '1.25rem', 
                background: 'linear-gradient(to bottom, rgba(37,99,235,0.1), transparent)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '1.25rem' 
              }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, 'list')} />
                <div 
                  className="avatar-edit-trigger"
                  style={{ 
                    width: '64px', height: '64px', borderRadius: '16px', 
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-mid)', 
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)', cursor: 'pointer', position: 'relative'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {candidatePreview?.photo_url ? (
                    <img src={getImageUrl(candidatePreview.photo_url) || ''} alt="Candidato" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Users size={32} style={{ color: 'var(--plra-300)' }} />
                  )}
                  <div className="avatar-edit-overlay">
                    <Image size={14} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {candidatePreview?.nombre ? `${candidatePreview.nombre} ${candidatePreview.apellido || ''}` : 'Verificar Candidato'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600 }}>Cargar competidores para el cálculo D'Hondt</p>
                </div>
                <button 
                  onClick={() => setShowListModal(false)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '0.75rem 1.25rem' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.2rem', display: 'block' }}>
                      Candidato (C.I.)
                    </label>
                    <div className="search-input-wrapper-premium">
                      <input 
                        className="modern-input-premium-styled" 
                        value={newListCandidateCI} 
                        onChange={e => setNewListCandidateCI(e.target.value)} 
                        placeholder="Nº de Cédula" 
                        autoFocus
                      />
                      <button type="button" onClick={handleLookupCandidate} className="search-btn-action">BUSCAR</button>
                    </div>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.2rem', display: 'block' }}>
                      Alias / Nombre Alianza
                    </label>
                    <input 
                      className="modern-input-premium-styled" 
                      value={newListAlias} 
                      onChange={e => setNewListAlias(e.target.value)} 
                      placeholder="Ej: ANR, FG..." 
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.2rem', display: 'block' }}>
                      Tipo de Candidatura
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {['INTENDENTE', 'CONCEJAL'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewListType(t)}
                          style={{
                            flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid',
                            fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                            background: newListType === t ? 'var(--blue-lt)' : 'rgba(255,255,255,0.03)',
                            borderColor: newListType === t ? 'var(--blue-lt)' : 'var(--border)',
                            color: newListType === t ? 'white' : 'var(--text-3)',
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.2rem', display: 'block' }}>
                      Número de Lista
                    </label>
                    {newListType === 'INTENDENTE' ? (
                      <input 
                        className="modern-input-premium-styled" 
                        value={newListNumber} 
                        onChange={e => setNewListNumber(e.target.value)} 
                        placeholder="Ej: 2" 
                      />
                    ) : (
                      <select 
                        className="modern-input-premium-styled" 
                        value={newListNumber} 
                        onChange={e => setNewListNumber(e.target.value)}
                        required
                      >
                        <option value="">Lista de Intendente...</option>
                        {resultados.filter(r => r.type === 'INTENDENTE').map(r => (
                          <option key={r.id} value={r.list_number}>{r.list_number} — {r.candidate_alias}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.2rem', display: 'block' }}>
                      Meta de Votos
                    </label>
                    <input 
                      type="number"
                      className="modern-input-premium-styled" 
                      value={newListGoal} 
                      onChange={e => setNewListGoal(parseInt(e.target.value))} 
                    />
                  </div>

                  {newListType === 'CONCEJAL' && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.6rem', marginBottom: '0.2rem', display: 'block', fontWeight: 800, color: 'var(--text-3)' }}>Opción (Posición)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.2rem' }}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => {
                          const isTaken = takenOptions.includes(n);
                          const isSelected = newListOption === n.toString();
                          return (
                            <button
                              key={n}
                              type="button"
                              disabled={isTaken && !isSelected}
                              onClick={() => setNewListOption(n.toString())}
                              style={{
                                height: '22px', borderRadius: '4px', border: '1px solid',
                                fontSize: '0.6rem', fontWeight: 800, cursor: isTaken ? 'not-allowed' : 'pointer',
                                transition: 'all 0.1s',
                                background: isSelected ? 'var(--blue-lt)' : isTaken ? 'rgba(255,0,0,0.1)' : 'rgba(255,255,255,0.03)',
                                borderColor: isSelected ? 'var(--blue-lt)' : isTaken ? 'rgba(255,0,0,0.2)' : 'var(--border)',
                                color: isSelected ? 'white' : isTaken ? 'var(--red)' : 'var(--text-3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="modal-footer-premium-styled" style={{ padding: '1rem 2rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setShowListModal(false)} className="btn-cancel-styled">CANCELAR</button>
                <button onClick={handleCreateList} className="btn-confirm-styled" style={{ minWidth: '140px' }} disabled={!isCandidateVerified}>
                  REGISTRAR LISTA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODALS --- */}

      <AnimatePresence>
        {showGlobalRegister && (
          <div className="modal-overlay" onClick={() => setShowGlobalRegister(false)}>
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '550px', padding: 0 }}
            >
              <div style={{ padding: '1.5rem', background: 'linear-gradient(to right, var(--blue-lt-10), transparent)', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <UserPlus size={20} style={{ color: 'var(--blue-lt)' }} /> Registro de Miembro de Mesa
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.3rem' }}>Vinculación directa con el padrón nacional</p>
              </div>

              <div style={{ padding: '2rem' }}>
                <div className="form-group">
                  <label>Cédula de Identidad</label>
                  <div className="search-input-wrapper-premium" style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      autoFocus
                      className="modern-input-premium-styled" 
                      placeholder="Ingrese CI para verificar..."
                      value={globalRegCI}
                      onChange={e => setGlobalRegCI(e.target.value)}
                    />
                    <button 
                      type="button" 
                      onClick={handleLookupGlobalCI} 
                      className="search-btn-action"
                      disabled={isVerifying}
                    >
                      {isVerifying ? 'BUSCANDO...' : 'VERIFICAR'}
                    </button>
                  </div>
                </div>

                {globalRegData && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ 
                      padding: '1rem', background: 'rgba(37,200,130,0.05)', 
                      border: '1px solid rgba(37,200,130,0.2)', borderRadius: '12px',
                      marginBottom: '1.5rem'
                    }}
                  >
                    <p style={{ fontSize: '0.6rem', color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Ciudadano Verificado</p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>{globalRegData.nombre} {globalRegData.apellido}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Local Padrón: {globalRegData.local_votacion} | Mesa: {globalRegData.mesa}</p>
                  </motion.div>
                )}

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Función en la Mesa</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {['PRESIDENTE', 'VOCAL', 'VEEDOR', 'APODERADO'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setGlobalRegRole(r);
                          if (r === 'APODERADO') setGlobalRegMesa(null);
                        }}
                        style={{
                          flex: 1, padding: '0.65rem', borderRadius: '10px', border: '1px solid',
                          fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                          background: globalRegRole === r ? '#1558B0' : 'var(--surface-light)',
                          borderColor: globalRegRole === r ? '#1558B0' : 'var(--border)',
                          color: globalRegRole === r ? '#FFFFFF' : 'var(--text-3)',
                          boxShadow: globalRegRole === r ? '0 4px 12px rgba(21,88,176,0.25)' : 'none',
                          textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Local de Votación (Destino)</label>
                    <select 
                      className="modern-input-premium-styled" 
                      value={globalRegLocal}
                      onChange={e => { setGlobalRegLocal(e.target.value); setGlobalRegMesa(null); }}
                    >
                      <option value="">Seleccione Local...</option>
                      {locations.map(loc => <option key={loc.cod_local} value={loc.nombre}>{loc.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Mesa Asignada</label>
                    {globalRegRole === 'APODERADO' ? (
                      <div style={{
                        padding: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                        borderRadius: '10px', fontSize: '0.72rem', color: 'var(--plra-300)', fontWeight: 700,
                        display: 'flex', alignItems: 'center', height: '38px'
                      }}>
                        📝 Cubre todo el Local (N/A)
                      </div>
                    ) : (
                      <select 
                        className="modern-input-premium-styled" 
                        value={globalRegMesa || ''}
                        onChange={e => setGlobalRegMesa(parseInt(e.target.value))}
                        disabled={!globalRegLocal}
                      >
                        <option value="">Seleccione Mesa...</option>
                        {coverage.mesas
                          .filter(m => m.local === globalRegLocal)
                          .map(m => (
                            <option key={`${m.local}-${m.numero}`} value={m.numero}>
                              Mesa {m.numero} {m.operativa ? '(Ocupada)' : '(Libre)'}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer-premium-styled" style={{ padding: '1rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setShowGlobalRegister(false)} className="btn-cancel-styled">Cancelar</button>
                <button 
                  type="button" 
                  onClick={handleGlobalAssign} 
                  className="btn-confirm-styled"
                  disabled={assigningLoading || !globalRegData || !globalRegLocal || (globalRegRole !== 'APODERADO' && !globalRegMesa)}
                >
                  {assigningLoading ? 'PROCESANDO...' : 'ASIGNAR MIEMBRO'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAssignModal && selectedMesa && (
          <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '450px', width: '90%' }}
            >
              <div className="modal-header-section">
                <h3>Asignar Miembro de Mesa</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
                  Local: <strong>{selectedMesa.local}</strong> · Mesa: <strong>{selectedMesa.numero}</strong>
                </p>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <div className="form-group">
                  <label>Seleccionar Usuario</label>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {usersToAssign.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center' }}>No hay usuarios disponibles para asignar.</p>}
                    {usersToAssign.map(u => (
                      <button
                        key={u.id}
                        onClick={async () => {
                          setAssigningLoading(true);
                          try {
                            await api.post('/diad/members/assign', { 
                              user_id: u.id, 
                              local: selectedMesa.local, 
                              mesa: selectedMesa.numero 
                            });
                            setShowAssignModal(false);
                            fetchData();
                          } catch (err) { console.error(err); }
                          finally { setAssigningLoading(false); }
                        }}
                        disabled={assigningLoading}
                        style={{
                          width: '100%', padding: '0.75rem', borderRadius: '10px',
                          background: 'var(--surface-light)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left',
                          cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        className="btn-hover-effect"
                      >
                        <div style={{ 
                          width: '32px', height: '32px', borderRadius: '50%', background: 'var(--blue)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.7rem'
                        }}>
                          {u.nombre?.[0] || 'U'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{u.nombre}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{u.role} · {u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer-premium-styled">
                <button onClick={() => setShowAssignModal(false)} className="btn-cancel-styled">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cropperData && (
          <ImageCropperModal 
            image={cropperData.image} 
            onCropComplete={onCropComplete} 
            onCancel={() => setCropperData(null)} 
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default DiaDApp;
