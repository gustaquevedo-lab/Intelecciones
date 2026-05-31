import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, AlertTriangle, Shield, BarChart3, Radio,
  ChevronDown,
  Download, MapPin, Bell, X, Search,
  ChevronRight, Truck, Target, MessageSquare, Mic, Clock,
  RefreshCw, CheckCircle, Plus, ExternalLink, Trash2, Edit
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

const TRAFFIC_COLORS: Record<string, string> = {
  GREEN: '#10B981',
  YELLOW: '#F59E0B',
  RED: '#EF4444',
  PURPLE: '#8B5CF6'
};

// Lazy load MapSection
const MapSection = lazy(() => import('./command-center/MapSection'));


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
            value={stats?.campaign_goal ?? settings?.campaign_goal ?? 1500} 
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
  const [editingCapture, setEditingCapture] = useState<any>(null);
  const [editTrafficLight, setEditTrafficLight] = useState<string>('GREEN');
  const [editNeedsTransport, setEditNeedsTransport] = useState<boolean>(false);
  const [editTelefono, setEditTelefono] = useState<string>('');
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
  const [showDisputesReportModal, setShowDisputesReportModal] = useState(false);
  const [disputesReportFilter, setDisputesReportFilter] = useState('GENERAL');
  const [disputesReportStatusFilter, setDisputesReportStatusFilter] = useState('TODAS');
  const [disputesReportSearch, setDisputesReportSearch] = useState('');
  const [disputesReportLocalFilter, setDisputesReportLocalFilter] = useState('');
  const [isGeneratingDisputesPDF, setIsGeneratingDisputesPDF] = useState(false);

  const handleExportReport = async (padrinoId: number) => {
    setIsGeneratingReport(true);
    try {
      const res = await api.get(`/reports/padrinos/${padrinoId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `reporte-padrino-${padrinoId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err: any) {
      console.error("Error generating report:", err);
      alert('Error al generar PDF: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsGeneratingReport(false);
    }
  };


  const exportDisputesPDF = async () => {
    setIsGeneratingDisputesPDF(true);
    try {
      const res = await api.get('/reports/disputes/pdf', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `reporte-disputas-${(effectiveDistrict || 'global').toLowerCase()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err: any) {
      console.error('Error downloading disputes PDF:', err);
      alert('Error al generar PDF: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsGeneratingDisputesPDF(false);
    }
  };

  const DisputesPremiumReportRenderer = () => {
    if (!isGeneratingDisputesPDF) return null;

    const safeDate = (d: any) => {
      if (!d) return 'N/A';
      try {
        const dt = new Date(String(d).replace(' ', 'T'));
        if (isNaN(dt.getTime())) return String(d);
        return dt.toLocaleDateString('es-PY') + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch { return String(d); }
    };

    const renderAvatar = (url: string | null, fallbackInitial: string) => {
      if (url && !url.includes('pravatar.cc') && !url.includes('ui-avatars.com')) {
        return <img src={getImageUrl(url)} crossOrigin="anonymous" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />;
      }
      return <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', border: '2px solid #cbd5e1' }}>{(fallbackInitial || 'A')[0].toUpperCase()}</div>;
    };

    const searchUpper = disputesReportSearch.toUpperCase();
    const filterItem = (item: any) => {
      if (searchUpper && !((`${item.elector_nombre} ${item.elector_apellido}`).toUpperCase().includes(searchUpper) || String(item.elector_ci).includes(searchUpper))) return false;
      if (disputesReportLocalFilter && item.local_votacion && item.local_votacion !== disputesReportLocalFilter) return false;
      return true;
    };

    const showActive = disputesReportStatusFilter === 'TODAS' || disputesReportStatusFilter === 'ACTIVAS';
    const showResolved = disputesReportStatusFilter === 'TODAS' || disputesReportStatusFilter === 'RESUELTAS';
    const filteredActive = showActive ? conflicts.filter(filterItem) : [];
    const filteredResolved = showResolved ? conflictsHistory.filter(filterItem) : [];

    const groupItems = (items: any[], isHistory: boolean) => {
      const groups: Record<string, any[]> = {};
      if (disputesReportFilter === 'LISTA') {
        items.forEach((c: any) => {
          const la = c.list_a || c.list_id_a || '?';
          const lb = c.list_b || c.list_id_b || la;
          const key = isHistory ? `Lista ${la}` : `Lista ${la} vs Lista ${lb}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(c);
        });
      } else if (disputesReportFilter === 'DISTRITO') {
        items.forEach((c: any) => {
          const key = effectiveDistrict || 'Distrito General';
          if (!groups[key]) groups[key] = [];
          groups[key].push(c);
        });
      } else if (disputesReportFilter === 'PADRINO') {
        items.forEach((c: any) => {
          const pa = c.padrino_a || c.padrino_name || 'Desconocido';
          const pb = c.padrino_b || pa;
          const key = isHistory ? `Padrino ${pa}` : `Padrino ${pa} vs Padrino ${pb}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(c);
        });
      } else {
        if (items.length > 0) groups['General'] = items;
      }
      return groups;
    };

    const activeGroups = groupItems(filteredActive, false);
    const resolvedGroups = groupItems(filteredResolved, true);

    return (
      <>
      {/* Full-screen overlay covers the print container so user sees a clean loading screen */}
      <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ color: '#fff', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>GENERANDO PDF...</p>
        </div>
      </div>
      {/* Print container: fully rendered, in-viewport, behind overlay so html2canvas can capture it */}
      <div style={{ position: 'fixed', top: '0', left: '0', width: '800px', zIndex: 9999, pointerEvents: 'none' }}>
        <div id="disputes-premium-print-container" style={{ width: '800px', background: '#fff', color: '#000', padding: '40px', fontFamily: 'Inter, system-ui, sans-serif' }}>
          
          <header style={{ borderBottom: '4px solid #0047AB', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', color: '#0047AB', fontWeight: 900, letterSpacing: '-0.03em' }}>REPORTE TÁCTICO DE DISPUTAS</h1>
              <p style={{ margin: '8px 0 0', fontSize: '14px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                DISTRITO: {effectiveDistrict || 'Todos'} <span style={{ color: '#cbd5e1', margin: '0 8px' }}>|</span> AGRUPACIÓN: {disputesReportFilter}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0047AB' }}>INTELEX v2.4</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{new Date().toLocaleString('es-PY')}</p>
            </div>
          </header>

          <section style={{ marginBottom: '40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
              <div style={{ background: '#fef2f2', padding: '18px', borderRadius: '12px', border: '1px solid #fecaca', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 800, letterSpacing: '0.05em' }}>DISPUTAS ACTIVAS</p>
                <p style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: 900, color: '#dc2626' }}>{filteredActive.length}</p>
              </div>
              <div style={{ background: '#f0fdf4', padding: '18px', borderRadius: '12px', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#10b981', fontWeight: 800, letterSpacing: '0.05em' }}>DISPUTAS RESUELTAS</p>
                <p style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: 900, color: '#059669' }}>{filteredResolved.length}</p>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '30px', fontWeight: 600 }}>
              Filtro Estado: {disputesReportStatusFilter} {disputesReportSearch ? `| Búsqueda: "${disputesReportSearch}"` : ''} {disputesReportLocalFilter ? `| Local: ${disputesReportLocalFilter}` : ''}
            </p>

            {Object.entries(activeGroups).map(([groupName, items]) => (
              <div key={groupName} style={{ marginBottom: '40px', breakInside: 'avoid' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px', color: '#dc2626', borderBottom: '2px solid #fecaca', paddingBottom: '8px' }}>
                  {groupName} — ACTIVAS ({items.length})
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {items.map((c: any) => (
                    <div key={c.conflict_id || c.elector_ci} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', padding: '16px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
                      
                      <div style={{ marginBottom: '12px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{c.elector_nombre} {c.elector_apellido}</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 }}>C.I: {c.elector_ci}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#0047AB', fontWeight: 700, background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>
                            {c.local_votacion || 'N/A'} (Mesa {c.mesa || '0'})
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'center' }}>
                        {/* Lado A */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                           {renderAvatar(c.photo_a, c.coord_a)}
                           <div>
                             <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#334155' }}>{c.coord_a || 'Desconocido'}</p>
                             <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                               <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: TRAFFIC_COLORS[c.tl_a as keyof typeof TRAFFIC_COLORS] || '#94a3b8' }}></span>
                               <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{c.tl_a || 'S/D'}</span>
                               {c.transport_a ? <span style={{ background: '#dbeafe', color: '#2563eb', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px' }}>TRANSP.</span> : null}
                             </div>
                             <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{safeDate(c.time_a)}</p>
                           </div>
                        </div>
                        
                        {/* VS */}
                        <div style={{ fontSize: '12px', fontWeight: 900, color: '#dc2626', background: '#fee2e2', padding: '6px 10px', borderRadius: '8px', border: '1px solid #fca5a5' }}>VS</div>
                        
                        {/* Lado B */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexDirection: 'row-reverse', textAlign: 'right' }}>
                           {renderAvatar(c.photo_b, c.coord_b)}
                           <div>
                             <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#334155' }}>{c.coord_b || 'Desconocido'}</p>
                             <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                               {c.transport_b ? <span style={{ background: '#dbeafe', color: '#2563eb', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px' }}>TRANSP.</span> : null}
                               <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{c.tl_b || 'S/D'}</span>
                               <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: TRAFFIC_COLORS[c.tl_b as keyof typeof TRAFFIC_COLORS] || '#94a3b8' }}></span>
                             </div>
                             <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{safeDate(c.time_b)}</p>
                           </div>
                        </div>
                      </div>
                      
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {Object.entries(resolvedGroups).map(([groupName, items]) => (
              <div key={groupName} style={{ marginBottom: '40px', breakInside: 'avoid' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px', color: '#059669', borderBottom: '2px solid #a7f3d0', paddingBottom: '8px' }}>
                  {groupName} — RESUELTAS ({items.length})
                </h3>
                
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '11px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ background: '#059669', color: 'white' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 800 }}>ELECTOR Y CÉDULA</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 800 }}>LOCAL DE VOTACIÓN</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 800 }}>ADJUDICADO A</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 800 }}>FECHA RESOLUCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((h: any, i: number) => (
                      <tr key={h.conflict_id || h.elector_ci} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0' }}>
                          <p style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '12px' }}>{h.elector_nombre} {h.elector_apellido}</p>
                          <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#64748b' }}>C.I: {h.elector_ci}</p>
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontWeight: 600 }}>{h.local_votacion || 'N/A'} <br/><span style={{ color: '#94a3b8' }}>(M. {h.mesa || '?'})</span></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'inline-block', background: '#e0e7ff', color: '#0047AB', padding: '4px 10px', borderRadius: '20px', fontWeight: 800 }}>
                            {h.winner_name || 'N/A'}
                          </div>
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{safeDate(h.resolved_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            
            {filteredActive.length === 0 && filteredResolved.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <p style={{ color: '#64748b', margin: 0, fontWeight: 800, fontSize: '14px' }}>No se encontraron disputas con los filtros seleccionados.</p>
              </div>
            )}
          </section>

          <footer style={{ marginTop: '50px', paddingTop: '20px', borderTop: '2px dashed #cbd5e1', textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
            Este documento es de carácter confidencial y estratégico para el operativo electoral de Intelecciones.
          </footer>
        </div>
      </div>
      </>
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
      
      api.get(`/voting-locations?${queryStr}`).then(res => {
        if (Array.isArray(res.data)) setLocales(res.data);
      }).catch(() => { });

      // Helper for independent state updates
      const fetchToState = async (url: string, setter: (data: any) => void) => {
        try {
          const res = await api.get(url);
          if (Array.isArray(res.data)) {
            setter(res.data);
          } else if (res.data && Array.isArray(res.data.data)) {
            setter(res.data.data);
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

  const handleWipeCoordinatorCaptures = async (coordinatorId: number) => {
    const confirmText = `¿Está seguro de que desea eliminar TODAS las capturas de este coordinador? Esta acción no se puede deshacer y liberará a todos sus electores.`;
    if (!window.confirm(confirmText)) return;
    
    const doubleCheck = prompt(`Por favor, escriba "ELIMINAR" para confirmar la eliminación masiva de capturas de ${selectedCoordDetails?.nombre}:`);
    if (doubleCheck !== 'ELIMINAR') {
      alert('Confirmación incorrecta. Acción cancelada.');
      return;
    }

    try {
      await api.delete(`/coordinators/${coordinatorId}/captures`);
      alert('Todas las capturas del coordinador fueron eliminadas correctamente.');
      setElectorDetails([]);
      if (selectedPadrino) {
        api.get(`/structure/padrinos/${selectedPadrino.id}/coordinators`).then(res => {
          setSubStructureData(res.data.coordinators || []);
          setPadrinoCaptures(res.data.padrino_captures || null);
        });
      }
      loadData();
    } catch (err: any) {
      console.error('Error wiping coordinator captures:', err);
      alert('Error al eliminar las capturas: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteIndividualCapture = async (captureId: number, electorName: string) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar la captura de ${electorName}? Esta acción liberará al elector.`)) return;

    try {
      await api.delete(`/captures/${captureId}`);
      alert('La captura fue eliminada correctamente.');
      if (selectedCoordDetails) {
        api.get(`/structure/coordinators/${selectedCoordDetails.id}/electors`).then(res => setElectorDetails(res.data));
      }
      if (selectedPadrino) {
        api.get(`/structure/padrinos/${selectedPadrino.id}/coordinators`).then(res => {
          setSubStructureData(res.data.coordinators || []);
          setPadrinoCaptures(res.data.padrino_captures || null);
        });
      }
      loadData();
    } catch (err: any) {
      console.error('Error deleting capture:', err);
      alert('Error al eliminar la captura: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCapture) return;
    if (editTelefono && editTelefono.replace(/\s/g, '').length < 10) {
      alert('El número de teléfono debe tener al menos 10 dígitos.');
      return;
    }
    try {
      await api.put(`/captures/${editingCapture.id}`, {
        traffic_light: editTrafficLight,
        needs_transport: editNeedsTransport,
        telefono: editTelefono ? editTelefono.replace(/\s/g, '') : ''
      });
      alert('Elector actualizado correctamente.');
      setEditingCapture(null);
      if (selectedCoordDetails) {
        api.get(`/structure/coordinators/${selectedCoordDetails.id}/electors`).then(res => setElectorDetails(res.data));
      }
      loadData();
    } catch (err: any) {
      console.error('Error updating capture:', err);
      alert('Error al actualizar la captura: ' + (err.response?.data?.error || err.message));
    }
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
            <Suspense fallback={<div className="animate-pulse bg-slate-800 h-full w-full rounded-2xl flex items-center justify-center text-slate-500">Cargando mapa táctico...</div>}>
              <MapSection
                locales={locales}
                selectedLocal={selectedLocal}
                effectiveDistrict={effectiveDistrict}
                commandStats={commandStats}
                handleLocalClick={handleLocalClick}
                clearLocalFilter={clearLocalFilter}
                isClusteringEnabled={isClusteringEnabled}
                setIsClusteringEnabled={setIsClusteringEnabled}
                captures={captures}
                trafficLightFilter={trafficLightFilter}
                setTrafficLightFilter={setTrafficLightFilter}
                needsTransportFilter={needsTransportFilter}
                setNeedsTransportFilter={setNeedsTransportFilter}
                selectedPadrinoLayers={selectedPadrinoLayers}
                setSelectedPadrinoLayers={setSelectedPadrinoLayers}
                selectedCoordLayers={selectedCoordLayers}
                setSelectedCoordLayers={setSelectedCoordLayers}
                coordinators={coordinators}
                structureData={structureData}
                showVehicles={showVehicles}
                setShowVehicles={setShowVehicles}
                vehicles={vehicles}
                isMobile={isMobile}
                showSidebar={showSidebar}
                conflictsCount={conflicts.length}
              />
            </Suspense>
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
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <a href={`https://wa.me/${selectedCoordDetails.telefono?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ background: '#22C55E', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '14px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <MessageSquare size={18} /> CONTACTAR
                        </a>
                        {['SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'].includes(authUser?.role || '') && selectedCoordDetails.role !== 'PADRINO_DIRECT' && (
                          <button
                            onClick={() => handleWipeCoordinatorCaptures(selectedCoordDetails.id)}
                            style={{
                              background: '#EF4444', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '14px',
                              border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 900,
                              display: 'flex', alignItems: 'center', gap: '0.6rem'
                            }}
                          >
                            <Trash2 size={18} /> ELIMINAR TODAS LAS CAPTURAS
                          </button>
                        )}
                      </div>
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
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <button onClick={() => window.open(`https://wa.me/${e.telefono?.replace(/\D/g, '')}`, '_blank')} style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Contactar por WhatsApp">
                                    <MessageSquare size={16} />
                                  </button>
                                  {['SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA', 'PADRINO', 'COORDINADOR', 'SUBJEFE'].includes(authUser?.role || '') && (
                                    <>
                                      <button 
                                        onClick={() => {
                                          setEditingCapture(e);
                                          setEditTrafficLight(e.traffic_light || 'GREEN');
                                          setEditNeedsTransport(e.needs_transport === 1);
                                          setEditTelefono(e.telefono || '');
                                        }}
                                        title="Editar Color / Datos"
                                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--plra-300)', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <Edit size={16} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteIndividualCapture(e.id, `${e.nombre} ${e.apellido}`)} 
                                        title="Eliminar Captura"
                                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
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
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                      onClick={() => setShowDisputesReportModal(true)}
                      style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: 'var(--red)', padding: '0.6rem 1rem', borderRadius: '14px',
                        cursor: 'pointer', fontWeight: 800, fontSize: '0.7rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                      }}
                    >
                      <Download size={14} /> REPORTE PDF
                    </button>
                    <div style={{ background: 'rgba(239,68,68,0.1)', padding: '0.6rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)', fontWeight: 900, fontSize: '0.8rem' }}>
                      {conflicts.length} ACTIVAS
                    </div>
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
                                    <Users size={12} style={{ color: 'var(--plra-300)' }} />
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
                                    <p style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conf.coord_b || 'No disponible'}</p>
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

                        {showResolveModal.conflict_status === 'WAITING_CONSENT' ? (
                            (user?.role === 'SUBJEFE' && user?.assigned_list_id === showResolveModal.list_id_a && showResolveModal.consent_a === 0) ? (
                                <button 
                                    onClick={() => handleConsent(showResolveModal.conflict_id)}
                                    style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: 'var(--blue)', color: 'white', border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: 'var(--shadow-sm)' }}
                                >
                                    CONSENTIR DECISIÓN
                                </button>
                            ) : (
                                <div style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: showResolveModal.jefe_decision_id === showResolveModal.capture_a_id ? 'var(--green)' : 'var(--surface-3)', color: showResolveModal.jefe_decision_id === showResolveModal.capture_a_id ? 'white' : 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 900, fontSize: '0.9rem', textAlign: 'center' }}>
                                    {showResolveModal.jefe_decision_id === showResolveModal.capture_a_id ? 'ADJUDICADO (Esperando Subjefe)' : 'DESCARTADO'}
                                </div>
                            )
                        ) : (
                            <button 
                                onClick={() => handleDecide(showResolveModal.capture_a_id)}
                                style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: 'var(--shadow-sm)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-4)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-3)'}
                            >
                                ADJUDICAR
                            </button>
                        )}
                    </div>
                  </div>

                  {/* Contender B Detail */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ padding: '1.5rem', borderRadius: '24px', background: 'var(--bg)', border: '1px solid var(--border)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: -12, left: 24, padding: '4px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>Última Captura · Lista {showResolveModal.list_b || 'N/A'}</div>
                        
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: showResolveModal.photo_b ? `url(${getImageUrl(showResolveModal.photo_b)}) center/cover` : 'var(--border)', border: '2px solid var(--red)' }} />
                            <div>
                                <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>{showResolveModal.coord_b || 'Coordinador no encontrado'}</p>
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

                        {showResolveModal.conflict_status === 'WAITING_CONSENT' ? (
                            (user?.role === 'SUBJEFE' && user?.assigned_list_id === showResolveModal.list_id_b && showResolveModal.consent_b === 0) ? (
                                <button 
                                    onClick={() => handleConsent(showResolveModal.conflict_id)}
                                    style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: 'var(--blue)', color: 'white', border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: 'var(--shadow-sm)' }}
                                >
                                    CONSENTIR DECISIÓN
                                </button>
                            ) : (
                                <div style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: showResolveModal.jefe_decision_id === showResolveModal.capture_b_id ? 'var(--green)' : 'var(--surface-3)', color: showResolveModal.jefe_decision_id === showResolveModal.capture_b_id ? 'white' : 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 900, fontSize: '0.9rem', textAlign: 'center' }}>
                                    {showResolveModal.jefe_decision_id === showResolveModal.capture_b_id ? 'ADJUDICADO (Esperando Subjefe)' : 'DESCARTADO'}
                                </div>
                            )
                        ) : (
                            <button 
                                onClick={() => handleDecide(showResolveModal.capture_b_id)}
                                style={{ width: '100%', padding: '1rem', borderRadius: '16px', background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: 'var(--shadow-sm)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-4)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-3)'}
                            >
                                ADJUDICAR
                            </button>
                        )}
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

        <AnimatePresence>
          {showDisputesReportModal && (
            <div className="modal-overlay" onClick={() => setShowDisputesReportModal(false)} style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>
              <motion.div
                className="modal-content"
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '480px', width: '95%', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>Generar Reporte de Disputas</h3>
                  <button onClick={() => setShowDisputesReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px' }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Preview counts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(239,68,68,0.08)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', margin: '0 0 2px', textTransform: 'uppercase' }}>Activas</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--red)', margin: 0 }}>{conflicts.length}</p>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.08)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', margin: '0 0 2px', textTransform: 'uppercase' }}>Resueltas</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', margin: 0 }}>{conflictsHistory.length}</p>
                  </div>
                </div>

                {/* Agrupación */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Agrupación</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['GENERAL', 'DISTRITO', 'LISTA', 'PADRINO'] as const).map(opt => (
                      <button key={opt} onClick={() => setDisputesReportFilter(opt)} style={{
                        flex: 1, padding: '0.6rem', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s',
                        background: disputesReportFilter === opt ? 'rgba(239,68,68,0.15)' : 'var(--bg)',
                        border: disputesReportFilter === opt ? '1px solid var(--red)' : '1px solid var(--border)',
                        color: disputesReportFilter === opt ? 'var(--red)' : 'var(--text-3)',
                      }}>{opt === 'GENERAL' ? 'General' : opt === 'DISTRITO' ? 'Distrito' : opt === 'LISTA' ? 'Lista' : 'Padrino'}</button>
                    ))}
                  </div>
                </div>

                {/* Status filter */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Incluir</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['TODAS', 'ACTIVAS', 'RESUELTAS'] as const).map(opt => (
                      <button key={opt} onClick={() => setDisputesReportStatusFilter(opt)} style={{
                        flex: 1, padding: '0.6rem', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s',
                        background: disputesReportStatusFilter === opt ? 'rgba(59,130,246,0.15)' : 'var(--bg)',
                        border: disputesReportStatusFilter === opt ? '1px solid var(--plra-300)' : '1px solid var(--border)',
                        color: disputesReportStatusFilter === opt ? 'var(--plra-300)' : 'var(--text-3)',
                      }}>{opt === 'TODAS' ? 'Todas' : opt === 'ACTIVAS' ? 'Solo Activas' : 'Solo Resueltas'}</button>
                    ))}
                  </div>
                </div>

                {/* Search + Local filter */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Buscar elector</p>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                      <input
                        type="text"
                        placeholder="Nombre o CI..."
                        value={disputesReportSearch}
                        onChange={e => setDisputesReportSearch(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Local votación</p>
                    <select
                      value={disputesReportLocalFilter}
                      onChange={e => setDisputesReportLocalFilter(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', boxSizing: 'border-box' }}
                    >
                      <option value="">Todos</option>
                      {locales.map(l => <option key={l.cod_local} value={l.nombre}>{l.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  disabled={isGeneratingDisputesPDF}
                  onClick={() => {
                    exportDisputesPDF();
                    setShowDisputesReportModal(false);
                  }}
                  style={{
                    width: '100%', padding: '1rem', borderRadius: '14px', background: isGeneratingDisputesPDF ? 'var(--text-3)' : 'var(--red)',
                    color: 'white', border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: isGeneratingDisputesPDF ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  <Download size={16} /> {isGeneratingDisputesPDF ? 'GENERANDO...' : 'DESCARGAR PDF'}
                </button>
              </motion.div>
            </div>
          )}

          {editingCapture && (
            <div className="modal-overlay" onClick={() => setEditingCapture(null)} style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', zIndex: 999999 }}>
              <motion.div
                className="modal-content"
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '500px', width: '95%', padding: 0, borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden' }}
              >
                <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>Editar Elector</h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>Modificar datos de la captura de elector</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setEditingCapture(null)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.5rem', color: 'var(--text)', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleUpdateCapture} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Elector Info */}
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>{editingCapture.nombre} {editingCapture.apellido}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600 }}>CI: {editingCapture.elector_ci}</p>
                  </div>

                  {/* Phone Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--plra-300)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Teléfono (WhatsApp)</label>
                    <input 
                      type="text"
                      placeholder="Ej: 0981123456"
                      value={editTelefono}
                      onChange={e => setEditTelefono(e.target.value.replace(/[^\d+]/g, ''))}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        color: 'white',
                        padding: '0.8rem 1rem',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Needs Transport Toggle */}
                  <div 
                    onClick={() => setEditNeedsTransport(!editNeedsTransport)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: editNeedsTransport ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${editNeedsTransport ? 'var(--plra-300)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Truck size={18} style={{ color: editNeedsTransport ? 'var(--plra-300)' : 'var(--text-3)' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>Necesita Transporte</span>
                    </div>
                    <div style={{
                      width: '36px', height: '18px', borderRadius: '9px',
                      background: editNeedsTransport ? 'var(--plra-300)' : 'rgba(255,255,255,0.1)',
                      position: 'relative'
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: editNeedsTransport ? 20 : 2,
                        width: '14px', height: '14px', borderRadius: '7px',
                        background: 'white', transition: 'left 0.2s'
                      }} />
                    </div>
                  </div>

                  {/* Semáforo Color Picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--plra-300)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Fidelidad (Semáforo)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                      {[
                        { id: 'GREEN', label: 'CASA', color: '#22C55E' },
                        { id: 'YELLOW', label: 'FAMILIARES', color: '#EAB308' },
                        { id: 'RED', label: 'OTROS', color: '#EF4444' },
                        { id: 'PURPLE', label: 'VOLUNTARIO', color: '#A855F7' }
                      ].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEditTrafficLight(item.id)}
                          style={{
                            padding: '0.6rem 0.25rem',
                            borderRadius: '10px',
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: editTrafficLight === item.id ? `${item.color}25` : 'rgba(255,255,255,0.02)',
                            color: editTrafficLight === item.id ? item.color : 'var(--text-3)',
                            border: `1px solid ${editTrafficLight === item.id ? item.color : 'var(--border)'}`
                          }}
                        >
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, margin: '0 auto 0.25rem' }} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setEditingCapture(null)}
                      style={{
                        flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)',
                        background: 'var(--surface-light)', color: 'var(--text-2)', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none',
                        background: 'var(--plra-500)', color: 'white', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer'
                      }}
                    >
                      Guardar Cambios
                    </button>
                  </div>

                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <DisputesPremiumReportRenderer />
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
              .print-only-report, .print-only-report *,
              #printable-report-area, #printable-report-area * { 
                visibility: visible !important; 
                height: auto !important;
                overflow: visible !important;
              }
              
              .print-only-report, #printable-report-area { 
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
