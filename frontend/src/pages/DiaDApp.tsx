import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Map, BarChart3, FileText, RefreshCw, Clock,
  CheckCircle2, AlertCircle, TrendingUp, Users, Award,
  Image, ChevronDown, ChevronUp, Zap, Shield
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../services/api';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ─── D'Hondt Algorithm ──────────────────────────────────────────────────────
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
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
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
          style={{ fill: 'white', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Space Grotesk', transform: 'rotate(90deg)', transformOrigin: '65px 65px' }}
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
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
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
  const { user } = useAuth();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<'cobertura' | 'resultados' | 'dhondt' | 'actas'>('cobertura');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Data
  const [coverage, setCoverage] = useState({
    total_mesas: 0, mesas_reportadas: 0, mesas_pendientes: 0,
    votos_procesados: 0, porcentaje: 0,
    mesas: [] as { id: number; numero: number; local: string; lat: number; lng: number; reportada: boolean }[]
  });
  const [resultados, setResultados] = useState<{
    id: number; list_number: string; candidate_alias: string; type: string;
    votos: number; porcentaje: number;
  }[]>([]);
  const [actas, setActas] = useState<{
    id: number; mesa_numero: number; local: string; submitted_by: string;
    votos_total: number; foto_url: string | null; submitted_at: string;
  }[]>([]);
  const [bancasConcejal, setBancasConcejal] = useState(15);
  const [expandedActa, setExpandedActa] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [covRes, resRes, actasRes] = await Promise.all([
        api.get('/diad/coverage').catch(() => ({ data: null })),
        api.get('/diad/results').catch(() => ({ data: null })),
        api.get('/diad/actas').catch(() => ({ data: null })),
      ]);
      if (covRes.data) setCoverage(covRes.data);
      if (resRes.data) setResultados(resRes.data);
      if (actasRes.data) setActas(actasRes.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('DiaDApp fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000); // every 30s
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // D'Hondt data
  const concejales = resultados.filter(r => r.type === 'CONCEJAL');
  const intendentes = resultados.filter(r => r.type === 'INTENDENTE');
  const dhondtInput = concejales.map(r => ({ id: r.id, nombre: r.candidate_alias || r.list_number, votos: r.votos }));
  const dhondtResult = calcularDHondt(dhondtInput, bancasConcejal);
  const maxVotos = Math.max(...resultados.map(r => r.votos), 1);

  const TABS = [
    { id: 'cobertura', label: 'Cobertura', icon: <Activity size={14} /> },
    { id: 'resultados', label: 'Resultados', icon: <BarChart3 size={14} /> },
    { id: 'dhondt', label: "D'Hondt", icon: <Award size={14} /> },
    { id: 'actas', label: 'Actas', icon: <FileText size={14} /> },
  ] as const;

  return (
    <MainLayout title="Día D — Centro de Resultados" userName={user?.nombre || ''} userPhoto={user?.photo_url}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 102px)', overflow: 'hidden' }}>

        {/* ── Top control bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.65rem 1.25rem', background: 'rgba(4,20,40,0.5)',
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
                  {/* Ring */}
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <p style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
                      Cobertura de Mesas
                    </p>
                    <CoverageRing
                      pct={coverage.porcentaje}
                      reported={coverage.mesas_reportadas}
                      total={coverage.total_mesas}
                    />
                    <div style={{
                      display: 'flex', gap: '0.5rem', marginTop: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.6rem', color: 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={10} /> {coverage.mesas_reportadas} con acta
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={10} /> {coverage.mesas_pendientes} pendientes
                      </span>
                    </div>
                  </div>

                  {/* KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                    <StatCard
                      label="Votos procesados"
                      value={coverage.votos_procesados.toLocaleString('es-PY')}
                      color="var(--blue-lt)"
                      icon={<Users size={12} />}
                    />
                    <StatCard
                      label="Mesas reportadas"
                      value={`${coverage.mesas_reportadas}/${coverage.total_mesas}`}
                      color="var(--green)"
                      icon={<CheckCircle2 size={12} />}
                    />
                    <StatCard
                      label="Cobertura"
                      value={`${coverage.porcentaje.toFixed(1)}%`}
                      color={coverage.porcentaje >= 80 ? 'var(--green)' : coverage.porcentaje >= 40 ? '#F59E0B' : 'var(--blue-lt)'}
                      sub="del total de mesas"
                      icon={<TrendingUp size={12} />}
                    />
                    <StatCard
                      label="Mesas pendientes"
                      value={coverage.mesas_pendientes}
                      color={coverage.mesas_pendientes > 0 ? '#F59E0B' : 'var(--green)'}
                      sub="sin acta cargada"
                      icon={<AlertCircle size={12} />}
                    />
                    <StatCard
                      label="Campaña"
                      value={settings.app_name || 'PLRA 2026'}
                      color="var(--text)"
                      icon={<Shield size={12} />}
                    />
                    <StatCard
                      label="Estado"
                      value={coverage.porcentaje >= 100 ? '✓ COMPLETO' : '● EN VIVO'}
                      color={coverage.porcentaje >= 100 ? 'var(--green)' : '#F59E0B'}
                    />
                  </div>
                </div>

                {/* Map */}
                <div style={{
                  background: 'rgba(4,20,40,0.6)', border: '1px solid var(--border)',
                  borderRadius: '14px', overflow: 'hidden', height: '380px'
                }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Map size={14} style={{ color: 'var(--plra-300)' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Mapa de Cobertura
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                      {[
                        { color: '#25C882', label: 'Acta cargada' },
                        { color: '#F59E0B', label: 'Pendiente' },
                      ].map(l => (
                        <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', color: 'var(--text-3)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <MapContainer
                    center={[-25.2867, -57.647]}
                    zoom={12}
                    style={{ height: 'calc(100% - 42px)', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; CartoDB'
                    />
                    <ZoomControl position="bottomright" />
                    {coverage.mesas.map(mesa => (
                      <CircleMarker
                        key={mesa.id}
                        center={[mesa.lat, mesa.lng]}
                        radius={7}
                        pathOptions={{
                          color: mesa.reportada ? '#25C882' : '#F59E0B',
                          fillColor: mesa.reportada ? '#25C882' : '#F59E0B',
                          fillOpacity: 0.85,
                          weight: 2
                        }}
                      >
                        <Popup>
                          <strong>Mesa {mesa.numero}</strong><br />
                          {mesa.local}<br />
                          <span style={{ color: mesa.reportada ? '#22c55e' : '#f59e0b' }}>
                            {mesa.reportada ? '✓ Acta cargada' : '⏳ Pendiente'}
                          </span>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              </motion.div>
            )}

            {/* ══════════ TAB: RESULTADOS ══════════ */}
            {activeTab === 'resultados' && (
              <motion.div key="resultados" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

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
                                {r.votos.toLocaleString('es-PY')}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', width: 44, textAlign: 'right' }}>
                                {r.porcentaje.toFixed(1)}%
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
                                {r.votos.toLocaleString('es-PY')}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', width: 44, textAlign: 'right' }}>
                                {r.porcentaje.toFixed(1)}%
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 700 }}>Bancas en juego:</label>
                    <input
                      type="number"
                      value={bancasConcejal}
                      onChange={e => setBancasConcejal(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      style={{
                        width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px', color: 'var(--text)', padding: '0.3rem 0.5rem',
                        fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '0.9rem', textAlign: 'center'
                      }}
                    />
                  </div>
                </div>

                {concejales.length > 0 ? (
                  <>
                    {/* D'Hondt visual result */}
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
                                {r.votos.toLocaleString('es-PY')} votos · {r.porcentaje.toFixed(1)}%
                              </span>
                            </motion.div>
                          );
                        })}
                    </div>

                    {/* Seat visualization */}
                    <div style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '14px', padding: '1.25rem'
                    }}>
                      <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '1rem' }}>
                        Distribución visual — {bancasConcejal} bancas
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(() => {
                          const seats: JSX.Element[] = [];
                          [...concejales]
                            .sort((a, b) => (dhondtResult[b.id] || 0) - (dhondtResult[a.id] || 0))
                            .forEach((r, i) => {
                              const b = dhondtResult[r.id] || 0;
                              const color = LIST_COLORS[i % LIST_COLORS.length];
                              for (let s = 0; s < b; s++) {
                                seats.push(
                                  <div
                                    key={`${r.id}-${s}`}
                                    title={`${r.candidate_alias || r.list_number} — banca ${s + 1}`}
                                    style={{
                                      width: 28, height: 28, borderRadius: '50%',
                                      background: color,
                                      boxShadow: `0 2px 8px ${color}60`,
                                      cursor: 'default'
                                    }}
                                  />
                                );
                              }
                            });
                          return seats;
                        })()}
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: '0.75rem' }}>
                        * Proyección basada en {coverage.porcentaje.toFixed(0)}% de actas procesadas. Resultado final sujeto a escrutinio oficial.
                      </p>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-3)' }}>
                    <Award size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 700 }}>Sin datos de concejales</p>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>Se necesitan actas cargadas con tipo CONCEJAL para calcular D'Hondt.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ══════════ TAB: ACTAS ══════════ */}
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
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                    {coverage.mesas_reportadas}/{coverage.total_mesas} mesas
                  </span>
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
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
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
                              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
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
    </MainLayout>
  );
};

export default DiaDApp;
