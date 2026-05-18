import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, Plus, ChevronDown, ChevronRight, Phone, Shield, UserCheck, X, AlertCircle, CheckCircle, Loader, Search, Camera, FileText, Printer, Download, Award, Activity } from 'lucide-react';
import api, { getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ImageCropperModal } from '../components/ImageCropperModal';

interface TeamUser {
  id: number;
  nombre: string;
  username: string;
  ci: string;
  telefono: string;
  photo_url: string;
  status: string;
  assigned_list_id?: number;
  list_number?: string;
  candidate_alias?: string;
  coordinator_count?: number;
  total_captures?: number;
  green?: number;
  yellow?: number;
  red?: number;
  purple?: number;
  needs_transport?: number;
  transport_total?: number;
}

interface ElectorRow {
  capture_id: number;
  elector_ci: string;
  elector_telefono: string;
  traffic_light: string;
  needs_transport: number;
  timestamp: string;
  nombre: string;
  apellido: string;
  local_votacion: string;
  mesa: number;
  orden: number;
  coordinator_name: string;
  coordinator_role: string;
  coordinator_photo: string;
  padrino_name: string;
  list_number: string;
  campaign_name: string;
  elector_district?: string;
  coordinator_district?: string;
  coordinator_list_id?: number;
  padrino_id?: string;
  coordinator_id?: string;
}

interface LocalRow {
  local_votacion: string;
  distrito?: string;
  total_captures: number;
  green: number;
  yellow: number;
  red: number;
  purple: number;
  needs_transport: number;
}

interface Campaign { id: number; name: string; distrito?: string; lists: any[]; }

const ROLE_COLORS: Record<string, string> = {
  SUBJEFE:      '#10B981', // Emerald
  PADRINO:      '#A855F7',
  COORDINADOR:  '#3B82F6',
  MIEMBRO_DE_MESA: '#F59E0B',
};

const TRAFFIC_COLORS: Record<string, string> = {
  GREEN: '#10B981',
  YELLOW: '#F59E0B',
  RED: '#EF4444',
  PURPLE: '#8B5CF6'
};

const RolePill = ({ role }: { role: string }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    padding: '2px 8px', borderRadius: '6px', fontSize: '0.58rem', fontWeight: 900,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    background: `${ROLE_COLORS[role] || '#6B7280'}20`,
    color: ROLE_COLORS[role] || '#9CA3AF',
    border: `1px solid ${ROLE_COLORS[role] || '#6B7280'}30`
  }}>
    {role.replace('_', ' ')}
  </span>
);

const StatDot = ({ count, color }: { count: number; color: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 800, color }}>
    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block' }} />
    {count}
  </span>
);

// ── Create User Modal ─────────────────────────────────────────────────────────
const CreateUserModal = ({
  onClose, onCreated, defaultRole, defaultParentId, campaigns
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultRole: 'PADRINO' | 'COORDINADOR' | 'MIEMBRO_DE_MESA';
  defaultParentId?: number;
  campaigns: Campaign[];
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    nombre: '', ci: '', telefono: '',
    role: defaultRole,
    assigned_list_id: '',
    parent_id: defaultParentId?.toString() || '',
    assigned_campaign_id: '',
    photo_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [padrinos, setPadrinos] = useState<TeamUser[]>([]);
  const [cropperData, setCropperData] = useState<{ image: string } | null>(null);

  // Load padrinos for assigning coordinators
  useEffect(() => {
    if (form.role === 'COORDINADOR') {
      if (user?.role === 'PADRINO') {
        setPadrinos([user as any]);
      } else {
        api.get('/my-team').then(r => {
          const fetched = r.data.padrinos || [];
          if (user?.role === 'SUBJEFE' && !fetched.find((p: any) => p.id === user.id)) {
            setPadrinos([user as any, ...fetched]);
          } else {
            setPadrinos(fetched);
          }
        }).catch(() => {});
      }
    }
  }, [form.role, user]);

  // C.I. Lookup Autocomplete
  useEffect(() => {
    const lookup = async () => {
      const cleanCI = form.ci.replace(/\./g, '');
      if (cleanCI.length >= 6) {
        try {
          const res = await api.get(`/admin/verify-user/${cleanCI}`);
          if (res.data) {
            setForm(f => ({
              ...f,
              nombre: `${res.data.nombre} ${res.data.apellido}`.trim(),
              photo_url: res.data.photo_url || f.photo_url
            }));
          }
        } catch {}
      }
    };
    const timer = setTimeout(lookup, 600);
    return () => clearTimeout(timer);
  }, [form.ci]);

  const formatPhone = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length <= 4) return clean;
    if (clean.length <= 7) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 10)}`;
  };

  const allLists = campaigns
    .filter(c => !user?.distrito || c.distrito === user.distrito)
    .flatMap(c => c.lists.map((l: any) => ({ ...l, campaign_name: c.name })));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropperData({ image: reader.result as string });
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = async (croppedBlob: Blob) => {
    setCropperData(null);
    try {
      const formData = new FormData();
      formData.append('photo', croppedBlob, 'profile.jpg');
      const res = await api.post('/upload-photo', formData);
      setForm(f => ({ ...f, photo_url: res.data.photo_url }));
    } catch (err) {
      setError('Error al subir la foto');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.ci.trim()) {
      setError('Nombre y Cédula son obligatorios.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        username: form.ci.replace(/\./g, ''),
        password: form.ci.replace(/\./g, ''),
        role: form.role,
        nombre: form.nombre.trim(),
        ci: form.ci.replace(/\./g, ''),
        telefono: form.telefono.replace(/\s/g, '') || null,
        assigned_list_id: form.assigned_list_id ? parseInt(form.assigned_list_id) : null,
        assigned_campaign_id: form.assigned_campaign_id ? parseInt(form.assigned_campaign_id) : (user?.assigned_campaign_id || null),
        parent_id: form.parent_id ? parseInt(form.parent_id) : null,
        photo_url: form.photo_url || null,
      };
      await api.post('/users', payload);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px',
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    color: 'var(--text)', fontSize: '0.88rem', fontWeight: 600, outline: 'none',
    boxSizing: 'border-box'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', 
      padding: '1rem', paddingTop: '80px', overflowY: 'auto'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px',
        width: '100%', maxWidth: '520px', padding: '2rem', position: 'relative',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8)', marginBottom: '2rem'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1.25rem', right: '1.25rem',
          background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
          borderRadius: '10px', width: '36px', height: '36px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)',
          transition: 'all 0.2s'
        }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
          <X size={18} />
        </button>

        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 1.5rem' }}>
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', height: '100%', borderRadius: '30px',
                background: form.photo_url ? `url(${getImageUrl(form.photo_url)}) center/cover` : 'rgba(255,255,255,0.03)',
                border: '2px dashed rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', transition: 'all 0.3s'
              }}
            >
              {!form.photo_url && <Camera size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute', bottom: '-5px', right: '-5px',
                width: '32px', height: '32px', borderRadius: '10px',
                background: 'var(--plra-300)', border: '3px solid var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}
            >
              <Plus size={16} />
            </button>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.4rem' }}>
            Nuevo Miembro de Equipo
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', maxWidth: '300px', margin: '0 auto' }}>
            Completa los datos para integrar un nuevo integrante a tu estructura.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>Cédula de Identidad *</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input 
                style={{ ...inputStyle, paddingLeft: '2.5rem' }} 
                placeholder="Sin puntos" 
                value={form.ci} 
                onChange={e => setForm(f => ({ ...f, ci: e.target.value.replace(/\D/g, '') }))} 
                required 
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Nombre Completo *</label>
            <input 
              style={inputStyle} 
              placeholder="Ej: Juan Pérez" 
              value={form.nombre} 
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} 
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Teléfono WhatsApp</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input 
                  style={{ ...inputStyle, paddingLeft: '2.5rem' }} 
                  placeholder="0981 123 456" 
                  value={form.telefono} 
                  onChange={e => setForm(f => ({ ...f, telefono: formatPhone(e.target.value) }))} 
                />
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Rol en el Equipo</label>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {[
                { id: 'PADRINO', label: 'Padrino', color: '#A855F7' },
                { id: 'COORDINADOR', label: 'Coordinador', color: '#3B82F6' },
                { id: 'MIEMBRO_DE_MESA', label: 'Mesa', color: '#F59E0B' }
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role: r.id as any }))}
                  style={{
                    padding: '0.7rem 1.2rem', borderRadius: '14px', fontSize: '0.72rem', fontWeight: 900,
                    cursor: 'pointer', transition: 'all 0.25s',
                    background: form.role === r.id ? `${r.color}20` : 'rgba(255,255,255,0.03)',
                    color: form.role === r.id ? r.color : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${form.role === r.id ? `${r.color}60` : 'rgba(255,255,255,0.08)'}`,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: form.role === r.id ? `0 4px 12px ${r.color}20` : 'none'
                  }}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: form.role === r.id ? r.color : 'rgba(255,255,255,0.2)' }} />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {allLists.length > 0 && (
            <div>
              <label style={labelStyle}>Lista de Concejales</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.assigned_list_id} onChange={e => {
                const listId = e.target.value;
                const list = allLists.find(l => l.id.toString() === listId);
                setForm(f => ({
                  ...f,
                  assigned_list_id: listId,
                  assigned_campaign_id: list?.campaign_id?.toString() || f.assigned_campaign_id
                }));
              }}>
                <option value="">Sin lista de concejales específica</option>
                {allLists.map(l => (
                  <option key={l.id} value={l.id}>
                    Lista {l.list_number} (Concejales){l.candidate_alias ? ` — ${l.candidate_alias}` : ''} ({l.campaign_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.role === 'COORDINADOR' && (
            <div>
              <label style={labelStyle}>Padrino Responsable</label>
              {defaultParentId ? (
                <div style={{ 
                  ...inputStyle, background: 'rgba(168,85,247,0.08)', color: '#A855F7', 
                  border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', gap: '0.6rem' 
                }}>
                  <UserCheck size={16} />
                  <span style={{ fontWeight: 800 }}>{padrinos.find(p => p.id === defaultParentId)?.nombre || 'Padrino Asignado'}</span>
                </div>
              ) : (
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">Seleccionar Padrino...</option>
                  {padrinos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              )}
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '12px', padding: '0.8rem'
            }}>
              <AlertCircle size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--red)', fontWeight: 700 }}>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: '1rem', borderRadius: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, var(--plra-300), var(--plra-500))',
            color: 'white', fontWeight: 900, fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            transition: 'all 0.3s', boxShadow: loading ? 'none' : '0 10px 20px rgba(59,130,246,0.3)'
          }} onMouseEnter={e => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}>
            {loading ? <><Loader size={20} className="spin" /> Procesando...</> : <><CheckCircle size={20} /> Confirmar Alta</>}
          </button>
        </form>
      </div>

      {cropperData && (
        <ImageCropperModal
          image={cropperData.image}
          onCropComplete={onCropComplete}
          onCancel={() => setCropperData(null)}
        />
      )}
    </div>
  );
};

// ── Padrino Row ────────────────────────────────────────────────────────────────
const PadrinoRow = ({
  padrino, campaigns, onRefresh, canCreate
}: {
  padrino: TeamUser; campaigns: Campaign[]; onRefresh: () => void; canCreate: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [coordinators, setCoordinators] = useState<TeamUser[]>([]);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [showCreateCoord, setShowCreateCoord] = useState(false);

  const loadCoordinators = useCallback(async () => {
    if (coordinators.length > 0) return;
    setLoadingCoords(true);
    try {
      const r = await api.get(`/my-team/padrino/${padrino.id}/coordinators`);
      setCoordinators(r.data);
    } catch {}
    setLoadingCoords(false);
  }, [padrino.id, coordinators.length]);

  const toggle = () => {
    if (!expanded) loadCoordinators();
    setExpanded(e => !e);
  };

  const handleCreated = () => {
    setCoordinators([]);
    loadCoordinators();
    onRefresh();
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
        background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)',
        borderRadius: '14px', marginBottom: '0.5rem', cursor: 'pointer',
        transition: 'background 0.15s'
      }} onClick={toggle}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: padrino.photo_url ? `url(${getImageUrl(padrino.photo_url)}) center/cover` : 'rgba(168,85,247,0.2)',
          border: '2px solid rgba(168,85,247,0.4)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
        }}>
          {!padrino.photo_url && '👤'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>{padrino.nombre}</span>
            <RolePill role="PADRINO" />
            {padrino.status === 'INACTIVE' && <span style={{ fontSize: '0.58rem', color: 'var(--red)', fontWeight: 900 }}>INACTIVO</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>CI: {padrino.ci || padrino.username}</span>
            {padrino.telefono && <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>📞 {padrino.telefono}</span>}
            {padrino.list_number && <span style={{ fontSize: '0.7rem', color: '#A855F7', fontWeight: 700 }}>Lista {padrino.list_number}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 700 }}>Coords</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#A855F7' }}>{padrino.coordinator_count ?? 0}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 700 }}>Captados</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--green)' }}>{padrino.total_captures ?? 0}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 700 }}>Logística</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--yellow)' }}>{padrino.needs_transport ?? 0}</div>
          </div>
          {expanded ? <ChevronDown size={16} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
          {canCreate && (
            <button onClick={() => setShowCreateCoord(true)} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.4)',
              borderRadius: '10px', color: '#3B82F6', padding: '0.6rem 1rem',
              fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginBottom: '0.75rem',
              width: '100%', justifyContent: 'center', transition: 'all 0.15s'
            }}>
              <Plus size={15} /> Agregar Coordinador bajo {padrino.nombre}
            </button>
          )}

          {loadingCoords && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
              <Loader size={16} style={{ display: 'inline', marginRight: '0.5rem' }} className="spin" />
              Cargando coordinadores...
            </div>
          )}

          {!loadingCoords && coordinators.length === 0 && (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
              Sin coordinadores asignados todavía.
            </div>
          )}

          {coordinators.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)',
              borderRadius: '10px', marginBottom: '0.35rem'
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                background: c.photo_url ? `url(${getImageUrl(c.photo_url)}) center/cover` : 'rgba(59,130,246,0.2)',
                border: '2px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
              }}>
                {!c.photo_url && '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>{c.nombre}</span>
                  <RolePill role="COORDINADOR" />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2' + 'rem', flexWrap: 'wrap' }}>
                  {c.ci && <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>CI: {c.ci}</span>}
                  {c.telefono && (
                    <a href={`https://wa.me/595${c.telefono.replace(/\D/g,'').replace(/^0/,'')}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: '0.65rem', color: '#22C55E', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      onClick={e => e.stopPropagation()}>
                      <Phone size={10} /> {c.telefono}
                    </a>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                  <div style={{ fontSize: '0.45rem', color: 'var(--text-3)', fontWeight: 800 }}>TOTAL</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text)' }}>{c.total_captures ?? 0}</div>
                </div>
                <StatDot count={c.green || 0} color="#22C55E" />
                <StatDot count={c.yellow || 0} color="#EAB308" />
                <StatDot count={c.red || 0} color="#EF4444" />
                <StatDot count={c.transport_total || 0} color="var(--plra-300)" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateCoord && (
        <CreateUserModal
          defaultRole="COORDINADOR"
          defaultParentId={padrino.id}
          campaigns={campaigns}
          onClose={() => setShowCreateCoord(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
};

// ── Main TeamPanel ────────────────────────────────────────────────────────────
const TeamPanel = () => {
  const { user, activeDistrict } = useAuth();
  const [activeTab, setActiveTab] = useState<'structure' | 'reports'>('structure');
  
  // Regular Team states
  const [padrinos, setPadrinos] = useState<TeamUser[]>([]);
  const [myCoordinators, setMyCoordinators] = useState<TeamUser[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePadrino, setShowCreatePadrino] = useState(false);

  // Reports states
  const [reportType, setReportType] = useState<'padrinos' | 'coordinators' | 'electors' | 'locales'>('padrinos');
  const [reportData, setReportData] = useState<{
    district: string;
    padrinos: TeamUser[];
    coordinators: any[];
    electors: ElectorRow[];
    locales: LocalRow[];
  } | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced Filters
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState('ALL');
  const [selectedListFilter, setSelectedListFilter] = useState('ALL');
  const [selectedPadrinoFilter, setSelectedPadrinoFilter] = useState('ALL');
  const [selectedCoordinatorFilter, setSelectedCoordinatorFilter] = useState('ALL');

  const isSuperOrJefe = user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA' || user?.role === 'SUBJEFE';
  const isPadrino = user?.role === 'PADRINO' || user?.role === 'SUBJEFE';

  // Available options derived dynamically
  const availableDistricts = useMemo(() => {
    if (!reportData) return [];
    const set = new Set<string>();
    if (reportData.padrinos) reportData.padrinos.forEach(p => p.distrito && set.add(p.distrito));
    if (reportData.coordinators) reportData.coordinators.forEach(c => c.distrito && set.add(c.distrito));
    if (reportData.locales) reportData.locales.forEach(l => l.distrito && set.add(l.distrito));
    return Array.from(set).sort();
  }, [reportData]);

  const availableLists = useMemo(() => {
    if (!reportData) return [];
    const set = new Set<string>();
    if (reportData.padrinos) reportData.padrinos.forEach(p => p.list_number && set.add(String(p.list_number)));
    if (reportData.coordinators) reportData.coordinators.forEach(c => c.list_number && set.add(String(c.list_number)));
    if (reportData.electors) reportData.electors.forEach(e => e.list_number && set.add(String(e.list_number)));
    return Array.from(set).sort();
  }, [reportData]);

  const availablePadrinos = useMemo(() => {
    if (!reportData) return [];
    return reportData.padrinos.filter(p => {
      if (selectedDistrictFilter !== 'ALL' && p.distrito !== selectedDistrictFilter) return false;
      if (selectedListFilter !== 'ALL' && String(p.list_number) !== selectedListFilter) return false;
      return true;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [reportData, selectedDistrictFilter, selectedListFilter]);

  const availableCoordinators = useMemo(() => {
    if (!reportData) return [];
    return reportData.coordinators.filter(c => {
      if (selectedDistrictFilter !== 'ALL' && c.distrito !== selectedDistrictFilter) return false;
      if (selectedListFilter !== 'ALL' && String(c.list_number) !== selectedListFilter) return false;
      if (selectedPadrinoFilter !== 'ALL' && c.parent_id !== selectedPadrinoFilter) return false;
      return true;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [reportData, selectedDistrictFilter, selectedListFilter, selectedPadrinoFilter]);

  // Filtered datasets for screen render & Excel/CSV export
  const filteredPadrinos = useMemo(() => {
    if (!reportData) return [];
    return reportData.padrinos.filter(p => {
      if (selectedDistrictFilter !== 'ALL' && p.distrito !== selectedDistrictFilter) return false;
      if (selectedListFilter !== 'ALL' && String(p.list_number) !== selectedListFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return p.nombre.toLowerCase().includes(q) || (p.ci && p.ci.includes(q)) || (p.username && p.username.includes(q));
      }
      return true;
    });
  }, [reportData, selectedDistrictFilter, selectedListFilter, searchQuery]);

  const filteredCoordinators = useMemo(() => {
    if (!reportData) return [];
    return reportData.coordinators.filter(c => {
      if (selectedDistrictFilter !== 'ALL' && c.distrito !== selectedDistrictFilter) return false;
      if (selectedListFilter !== 'ALL' && String(c.list_number) !== selectedListFilter) return false;
      if (selectedPadrinoFilter !== 'ALL' && c.parent_id !== selectedPadrinoFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return c.nombre.toLowerCase().includes(q) || (c.ci && c.ci.includes(q)) || (c.username && c.username.includes(q));
      }
      return true;
    });
  }, [reportData, selectedDistrictFilter, selectedListFilter, selectedPadrinoFilter, searchQuery]);

  const filteredElectors = useMemo(() => {
    if (!reportData) return [];
    return reportData.electors.filter(e => {
      if (selectedDistrictFilter !== 'ALL') {
        if (e.elector_district !== selectedDistrictFilter && e.coordinator_district !== selectedDistrictFilter) return false;
      }
      if (selectedListFilter !== 'ALL' && String(e.list_number) !== selectedListFilter) return false;
      if (selectedPadrinoFilter !== 'ALL' && e.padrino_id !== selectedPadrinoFilter) return false;
      if (selectedCoordinatorFilter !== 'ALL' && e.coordinator_id !== selectedCoordinatorFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.nombre.toLowerCase().includes(q) || e.apellido.toLowerCase().includes(q) || (e.elector_ci && e.elector_ci.includes(q));
      }
      return true;
    });
  }, [reportData, selectedDistrictFilter, selectedListFilter, selectedPadrinoFilter, selectedCoordinatorFilter, searchQuery]);

  const filteredLocales = useMemo(() => {
    if (!reportData) return [];
    return reportData.locales.filter(l => {
      if (selectedDistrictFilter !== 'ALL' && l.distrito !== selectedDistrictFilter) return false;
      if (searchQuery) {
        return l.local_votacion.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [reportData, selectedDistrictFilter, searchQuery]);

  // Load team data
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, campaignsRes] = await Promise.all([
        api.get('/my-team'),
        api.get('/campaigns/mine')
      ]);
      setPadrinos(teamRes.data.padrinos || []);
      setMyCoordinators(teamRes.data.coordinators || []);
      setCampaigns(campaignsRes.data || []);
    } catch {}
    setLoading(false);
  }, [activeDistrict]);

  useEffect(() => { load(); }, [load]);

  // Load reports data
  const loadReportsData = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await api.get('/my-team/reports');
      setReportData(res.data);
    } catch (err) {
      console.error('Error fetching reports data', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReportsData();
    }
  }, [activeTab, loadReportsData]);

  // Pure JavaScript CSV Exporter
  const exportToCSV = () => {
    if (!reportData) return;

    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `reporte_${reportType}_intelecciones.csv`;

    if (reportType === 'padrinos') {
      headers = ["Nombre", "Cédula", "Teléfono", "Coordinadores", "Total Capturas", "Verdes (Seguros)", "Amarillos", "Rojos", "Morados", "Necesita Transporte"];
      rows = filteredPadrinos.map(p => [
        p.nombre,
        p.ci || p.username,
        p.telefono || "",
        p.coordinator_count || 0,
        p.total_captures || 0,
        p.green || 0,
        p.yellow || 0,
        p.red || 0,
        p.purple || 0,
        p.needs_transport || 0
      ]);
    } else if (reportType === 'coordinators') {
      headers = ["Nombre", "Cédula", "Teléfono", "Padrino Asignado", "Total Capturas", "Verdes (Seguros)", "Amarillos", "Rojos", "Morados", "Necesita Transporte"];
      rows = filteredCoordinators.map(c => [
        c.nombre,
        c.ci || c.username,
        c.telefono || "",
        c.parent_name || "Sin Padrino",
        c.total_captures || 0,
        c.green || 0,
        c.yellow || 0,
        c.red || 0,
        c.purple || 0,
        c.needs_transport || 0
      ]);
    } else if (reportType === 'electors') {
      headers = ["Nombre", "Apellido", "Cédula", "Teléfono", "Local de Votación", "Mesa", "Orden", "Semáforo", "Necesita Transporte", "Coordinador", "Padrino"];
      rows = filteredElectors.map(e => [
        e.nombre,
        e.apellido,
        e.elector_ci,
        e.elector_telefono || "",
        e.local_votacion,
        e.mesa,
        e.orden,
        e.traffic_light,
        e.needs_transport ? "SI" : "NO",
        e.coordinator_name || "",
        e.padrino_name || ""
      ]);
    } else if (reportType === 'locales') {
      headers = ["Local de Votación", "Total Electores Captados", "Verdes (Seguros)", "Amarillos", "Rojos", "Morados", "Necesita Transporte"];
      rows = filteredLocales.map(l => [
        l.local_votacion,
        l.total_captures,
        l.green,
        l.yellow,
        l.red,
        l.purple,
        l.needs_transport
      ]);
    }

    // Combine headers and rows
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(val => {
        let stringVal = val === null || val === undefined ? "" : String(val);
        // Replace semicolons to avoid messing up column structure
        return `"${stringVal.replace(/"/g, '""')}"`;
      }).join(";"))
    ].join("\n");

    // Create file blob and download
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
      <Loader size={28} style={{ color: 'var(--plra-300)', animation: 'spin 1s linear infinite' }} />
      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 700 }}>Cargando equipo...</span>
    </div>
  );

  return (
    <div style={{ padding: 'clamp(1rem, 3vw, 2rem)', maxWidth: '1050px', margin: '0 auto' }}>
      
      {/* Dynamic Print-Only Stylesheet Injection */}
      <style>{`
        @media print {
          /* Hide all page content except the printable report */
          body * {
            visibility: hidden !important;
            background: white !important;
            color: black !important;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible !important;
          }
          #printable-report-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 15mm !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border-bottom: 1px solid #ddd !important;
            color: black !important;
            font-size: 8pt !important;
            padding: 6px 4px !important;
          }
          th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          .print-header {
            border-bottom: 3px double #333 !important;
            padding-bottom: 8px !important;
            margin-bottom: 15px !important;
          }
          .avatar-print {
            border: 1px solid #ccc !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.3rem' }}>
            Mi <span style={{ color: 'var(--plra-300)' }}>Equipo</span>
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 600 }}>
            {isSuperOrJefe
              ? `${padrinos.length} padrinos · ${padrinos.reduce((s, p) => s + (p.coordinator_count ?? 0), 0)} coordinadores`
              : `${myCoordinators.length} coordinadores bajo tu gestión`}
          </p>
        </div>
        
        {/* Toggle between view and premium report */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('structure')}
            style={{
              padding: '0.6rem 1.1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === 'structure' ? 'var(--plra-500)' : 'rgba(255,255,255,0.03)',
              color: 'white',
              border: activeTab === 'structure' ? 'none' : '1px solid var(--border)'
            }}
          >
            🗂️ Estructura
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            style={{
              padding: '0.6rem 1.1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === 'reports' ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(255,255,255,0.03)',
              color: 'white',
              border: activeTab === 'reports' ? 'none' : '1px solid var(--border)',
              boxShadow: activeTab === 'reports' ? '0 4px 15px rgba(16,185,129,0.2)' : 'none'
            }}
          >
            📊 Reportes Premium
          </button>
        </div>
      </div>

      {/* ── TABS RENDERING ── */}
      {activeTab === 'structure' ? (
        <>
          {/* Action Header bar (Create users) */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            {isSuperOrJefe && (
              <button onClick={() => setShowCreatePadrino(true)} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--plra-500)', border: 'none', borderRadius: '12px',
                color: 'white', padding: '0.7rem 1.25rem',
                fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer', flexShrink: 0
              }}>
                <Plus size={16} /> Nuevo Padrino
              </button>
            )}
          </div>

          {/* Campaign/List summary pills */}
          {campaigns.length > 0 && (
            <div className="no-print" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {campaigns.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.9rem', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)'
                }}>
                  <Shield size={12} style={{ color: 'var(--plra-300)' }} />
                  {c.name}
                  <span style={{ color: 'var(--text-3)' }}>·</span>
                  <span style={{ color: 'var(--text-3)' }}>{c.lists.length} listas</span>
                </div>
              ))}
            </div>
          )}

          {/* JEFE_CAMPANA / SUPERUSUARIO: padrinos tree */}
          {isSuperOrJefe && (
            <>
              {padrinos.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '3rem 1rem',
                  border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px'
                }}>
                  <Users size={40} style={{ color: 'var(--text-3)', opacity: 0.4, marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-2)', fontWeight: 700, marginBottom: '0.5rem' }}>No hay padrinos todavía</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Crea el primer padrino para comenzar a construir tu equipo.</p>
                </div>
              ) : (
                padrinos.map(p => (
                  <PadrinoRow
                    key={p.id}
                    padrino={p}
                    campaigns={campaigns}
                    onRefresh={load}
                    canCreate={true}
                  />
                ))
              )}
            </>
          )}

          {/* PADRINO: their own coordinators */}
          {isPadrino && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>
                  <UserCheck size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--plra-300)' }} />
                  Mis Coordinadores
                </h3>
                <button onClick={() => setShowCreatePadrino(true)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '10px', color: '#3B82F6', padding: '0.5rem 1rem',
                  fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer'
                }}>
                  <Plus size={14} /> Nuevo Coordinador
                </button>
              </div>

              {myCoordinators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                  <Users size={32} style={{ color: 'var(--text-3)', opacity: 0.3, marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>No tienes coordinadores asignados todavía.</p>
                </div>
              ) : (
                myCoordinators.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.9rem 1.1rem',
                    background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)',
                    borderRadius: '12px', marginBottom: '0.4rem'
                  }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                      background: c.photo_url ? `url(${getImageUrl(c.photo_url)}) center/cover` : 'rgba(59,130,246,0.2)',
                      border: '2px solid rgba(59,130,246,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'
                    }}>
                      {!c.photo_url && '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: '0.9rem' }}>{c.nombre}</span>
                        <RolePill role="COORDINADOR" />
                      </div>
                      {c.telefono && (
                        <a href={`https://wa.me/595${c.telefono.replace(/\D/g,'').replace(/^0/,'')}`}
                          target="_blank" rel="noreferrer"
                          style={{ fontSize: '0.68rem', color: '#22C55E', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}>
                          <Phone size={10} /> {c.telefono}
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                        <div style={{ fontSize: '0.45rem', color: 'var(--text-3)', fontWeight: 800 }}>TOTAL</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)' }}>{c.total_captures ?? 0}</div>
                      </div>
                      <StatDot count={c.green || 0} color="#22C55E" />
                      <StatDot count={c.yellow || 0} color="#EAB308" />
                      <StatDot count={c.red || 0} color="#EF4444" />
                      <StatDot count={c.transport_total || 0} color="var(--plra-300)" />
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </>
      ) : (
        /* ─── REPORTS TAB VIEW ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Controls Bar */}
          <div className="no-print" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1rem 1.25rem', background: 'var(--surface-hover)', borderRadius: '16px',
            border: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem'
          }}>
            {/* Report Selector Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { id: 'padrinos', label: 'Listado de Padrinos', visible: isSuperOrJefe },
                { id: 'coordinators', label: 'Listado de Coordinadores', visible: true },
                { id: 'electors', label: 'Electores Registrados', visible: true },
                { id: 'locales', label: 'Cobertura de Locales', visible: true }
              ].filter(t => t.visible).map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setReportType(t.id as any);
                    setSelectedPadrinoFilter('ALL');
                    setSelectedCoordinatorFilter('ALL');
                  }}
                  style={{
                    padding: '0.5rem 0.9rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: reportType === t.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                    color: reportType === t.id ? '#10B981' : 'var(--text-3)',
                    border: `1px solid ${reportType === t.id ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Print and Export Buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', width: '180px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  style={{
                    width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: '10px',
                    background: 'var(--input-bg)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box'
                  }}
                  placeholder="Buscar en reporte..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                onClick={exportToCSV}
                disabled={loadingReports || !reportData}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-2)', padding: '0.5rem 0.9rem',
                  fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <Download size={14} /> CSV / Excel
              </button>

              <button
                onClick={() => {
                  // Pre-print instructions for ideal PDF output
                  const guideMsg = "✍️ INSTRUCCIONES DE EXPORTACIÓN (PDF):\n\n1. En la ventana que se abrirá, selecciona 'Guardar como PDF' (Save as PDF) en el Destino.\n2. Asegúrate de activar la casilla 'Gráficos de fondo' (Background Graphics) en la sección 'Más opciones' para conservar los hermosos colores y diseños del semáforo.\n3. ¡Haz clic en Guardar!";
                  alert(guideMsg);
                  window.print();
                }}
                disabled={loadingReports || !reportData}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: '#EF4444', border: 'none',
                  borderRadius: '10px', color: 'white', padding: '0.5rem 1.1rem',
                  fontSize: '0.78rem', fontWeight: 850, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 10px rgba(239,68,68,0.3)'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <FileText size={14} /> Exportar PDF
              </button>

              <button
                onClick={handlePrint}
                disabled={loadingReports || !reportData}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: '#10B981', border: 'none',
                  borderRadius: '10px', color: 'white', padding: '0.5rem 1.1rem',
                  fontSize: '0.78rem', fontWeight: 850, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 10px rgba(16,185,129,0.3)'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Printer size={14} /> Imprimir A4
              </button>
            </div>
          </div>

          {/* Dynamic Filters Bar */}
          {!loadingReports && reportData && (
            <div className="no-print" style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem',
              padding: '1.25rem', background: 'var(--surface-hover)', borderRadius: '16px',
              border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box'
            }}>
              {/* District Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Distrito</span>
                <select
                  value={selectedDistrictFilter}
                  onChange={(e) => {
                    setSelectedDistrictFilter(e.target.value);
                    setSelectedPadrinoFilter('ALL');
                    setSelectedCoordinatorFilter('ALL');
                  }}
                  disabled={user?.role === 'SUBJEFE' || user?.role === 'PADRINO'}
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', color: 'white', fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="ALL">Todos los Distritos ({availableDistricts.length})</option>
                  {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* List Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lista de Concejales</span>
                <select
                  value={selectedListFilter}
                  onChange={(e) => {
                    setSelectedListFilter(e.target.value);
                    setSelectedPadrinoFilter('ALL');
                    setSelectedCoordinatorFilter('ALL');
                  }}
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', color: 'white', fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="ALL">Todas las Listas de Concejales</option>
                  {availableLists.map(l => <option key={l} value={l}>Lista {l} (Concejales)</option>)}
                </select>
              </div>

              {/* Padrino Filter */}
              {reportType !== 'padrinos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Padrino Asignado</span>
                  <select
                    value={selectedPadrinoFilter}
                    onChange={(e) => {
                      setSelectedPadrinoFilter(e.target.value);
                      setSelectedCoordinatorFilter('ALL');
                    }}
                    style={{
                      width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'var(--input-bg)',
                      border: '1px solid var(--border)', color: 'white', fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">Todos los Padrinos ({availablePadrinos.length})</option>
                    {availablePadrinos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}

              {/* Coordinator Filter */}
              {reportType === 'electors' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coordinador de Campo</span>
                  <select
                    value={selectedCoordinatorFilter}
                    onChange={(e) => setSelectedCoordinatorFilter(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'var(--input-bg)',
                      border: '1px solid var(--border)', color: 'white', fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">Todos los Coordinadores ({availableCoordinators.length})</option>
                    {availableCoordinators.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Loading reports state */}
          {loadingReports && (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-3)' }}>
              <Loader size={32} className="spin" style={{ display: 'block', margin: '0 auto 1rem', color: '#10B981' }} />
              Generando reporte de alta fidelidad...
            </div>
          )}

          {/* Simulated A4 Vertical Paper Sheet on Screen */}
          {!loadingReports && reportData && (
            <div style={{ overflowX: 'auto', padding: '0.5rem' }}>
              <div 
                id="printable-report-area"
                style={{
                  background: 'white',
                  color: '#1a1a1a',
                  width: '210mm',
                  minHeight: '297mm',
                  margin: '0 auto',
                  padding: '20mm 15mm',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  border: '1px solid #e0e0e0',
                  boxSizing: 'border-box',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                {/* ── REPORT EMBEDDED HEADER ── */}
                <div className="print-header" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  borderBottom: '2.5px solid #1e3a6e', paddingBottom: '10px', marginBottom: '20px'
                }}>
                  {/* Branding and Typographic Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Inline Premium Ballot Box Isotipo */}
                    <svg viewBox="0 0 80 80" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="80" height="80" rx="18" fill="#1E3A6E" />
                      <g transform="translate(40,30) rotate(-10)">
                        <rect x="-11" y="-14" width="22" height="19" rx="2" fill="white" />
                        <path d="M-8,1 L-1,8 L10,-7" fill="none" stroke="#22C47E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                      <rect x="12" y="41" width="56" height="8" rx="2" fill="white" />
                      <rect x="15" y="47" width="50" height="29" rx="3" fill="white" />
                    </svg>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#1e3a6e' }}>
                        Inte<span style={{ color: '#10b981' }}>lecciones</span>
                      </h1>
                      <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666' }}>
                        Gestión Electoral & Logística
                      </p>
                    </div>
                  </div>

                  {/* Document Metadata */}
                  <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#444', lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 800, color: '#1e3a6e', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                      Reporte de Campaña
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#555', marginTop: '2px' }}>
                      Distrito: <span style={{ fontWeight: 700 }}>{selectedDistrictFilter === 'ALL' ? 'Todos los Distritos' : selectedDistrictFilter}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#555' }}>
                      Lista de Concejales: <span style={{ fontWeight: 700 }}>{selectedListFilter === 'ALL' ? 'Todas las Listas de Concejales' : `Lista ${selectedListFilter} (Concejales)`}</span>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#888', fontStyle: 'italic', marginTop: '4px' }}>
                      Fecha Imp.: {new Date().toLocaleString('es-PY')}
                    </div>
                  </div>
                </div>

                {/* Report Specific Title and Subheader */}
                <div style={{ marginBottom: '15px' }}>
                  <h2 style={{ margin: '0 0 5px', fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: '#111', letterSpacing: '0.02em' }}>
                    {reportType === 'padrinos' && "Listado y Reporte de Estructura de Padrinos"}
                    {reportType === 'coordinators' && "Listado y Reporte de Estructura de Coordinadores"}
                    {reportType === 'electors' && "Registro Global de Electores Captados"}
                    {reportType === 'locales' && "Resumen de Cobertura y Semáforo por Locales de Votación"}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', lineHeight: 1.4 }}>
                    {reportType === 'padrinos' && "Resumen consolidado de la cúpula de padrinos activos en el distrito, incluyendo sus respectivas redes de coordinadores y cobertura de capturas de campo."}
                    {reportType === 'coordinators' && "Detalle completo de coordinadores de campo asignados, sus padrinos directos y la cuantificación cromática de sus gestiones de captación."}
                    {reportType === 'electors' && "Listado detallado de electores ingresados y verificados en calle, indicando su nivel de compromiso (Semáforo de Intención) y su asignación logística de transporte."}
                    {reportType === 'locales' && "Auditoría de cobertura geográfica y territorial. Distribución de capturas y porcentaje de electores seguros en cada colegio electoral oficial."}
                  </p>
                </div>

                {/* ─── REPORT CONTENT TABLES ─── */}
                
                {/* 1. PADRINOS TABLE */}
                {reportType === 'padrinos' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Foto</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Padrino / Cédula</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Teléfono</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Lista</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Coords</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Total</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Verde</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Amarillo</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Rojo</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Mora.</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Transp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPadrinos.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', height: '36px' }}>
                          <td style={{ padding: '4px 6px' }}>
                            <div className="avatar-print" style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: p.photo_url ? `url(${getImageUrl(p.photo_url)}) center/cover` : '#eee',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px'
                            }}>
                              {!p.photo_url && '👤'}
                            </div>
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>
                            <div>{p.nombre}</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 500 }}>CI: {p.ci || p.username}</div>
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '0.68rem', color: '#334155' }}>{p.telefono || "—"}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#a855f7' }}>
                            {p.list_number ? `Lista ${p.list_number}` : "—"}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                            {p.coordinator_count || 0}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                            {p.total_captures || 0}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>{p.green || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#d97706' }}>{p.yellow || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>{p.red || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed' }}>{p.purple || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#2563eb' }}>{p.needs_transport || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 2. COORDINATORS TABLE */}
                {reportType === 'coordinators' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Foto</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Coordinador / CI</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Padrino Asignado</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Teléfono</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Total</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Verde</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Amarillo</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Rojo</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Mora.</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Transp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCoordinators.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0', height: '36px' }}>
                          <td style={{ padding: '4px 6px' }}>
                            <div className="avatar-print" style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: c.photo_url ? `url(${getImageUrl(c.photo_url)}) center/cover` : '#eee',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px'
                            }}>
                              {!c.photo_url && '👤'}
                            </div>
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>
                            <div>{c.nombre}</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 500 }}>CI: {c.ci || c.username}</div>
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '0.68rem', fontWeight: 600, color: '#6b21a8' }}>
                            {c.parent_name || "Sin Padrino"}
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '0.68rem', color: '#334155' }}>{c.telefono || "—"}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                            {c.total_captures || 0}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>{c.green || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#d97706' }}>{c.yellow || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>{c.red || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed' }}>{c.purple || 0}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#2563eb' }}>{c.needs_transport || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 3. ELECTORS TABLE */}
                {reportType === 'electors' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Elector / CI</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Teléfono</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Local de Votación</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Mesa</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Orden</th>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Captado Por</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Semáforo</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>Transp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredElectors.map(e => (
                        <tr key={e.capture_id} style={{ borderBottom: '1px solid #e2e8f0', height: '36px' }}>
                          <td style={{ padding: '4px 6px', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>
                            <div>{e.nombre} {e.apellido}</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 500 }}>CI: {e.elector_ci}</div>
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '0.68rem', color: '#334155' }}>{e.elector_telefono || "—"}</td>
                          <td style={{ padding: '4px 6px', fontSize: '0.68rem', color: '#475569', fontWeight: 500 }}>
                            {e.local_votacion}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700 }}>{e.mesa || "—"}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700 }}>{e.orden || "—"}</td>
                          <td style={{ padding: '4px 6px', fontSize: '0.68rem', color: '#0f172a' }}>
                            <div style={{ fontWeight: 600 }}>{e.coordinator_name}</div>
                            <div style={{ fontSize: '0.58rem', color: '#a855f7', fontWeight: 700 }}>
                              {e.padrino_name ? `Padrino: ${e.padrino_name}` : "Asignación Directa"}
                            </div>
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
                              background: TRAFFIC_COLORS[e.traffic_light] || '#ccc'
                            }} title={e.traffic_light} />
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: e.needs_transport ? '#2563eb' : '#64748b' }}>
                            {e.needs_transport ? "SÍ" : "NO"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 4. VOTING CENTERS COVERAGE TABLE */}
                {reportType === 'locales' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Colegio Electoral (Local de Votación)</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Total Captados</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Voto Seguro (Verde)</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Duda (Amarillo)</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Oposición (Rojo)</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Mora.</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Recl. Transp.</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>Cobertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLocales.map((l, index) => {
                        const total = l.total_captures || 1;
                        const pctGreen = Math.round((l.green / total) * 100);
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', height: '36px' }}>
                            <td style={{ padding: '4px 6px', fontSize: '0.72rem', fontWeight: 700, color: '#1e3a6e' }}>
                              {l.local_votacion}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 800 }}>
                              {l.total_captures}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>
                              {l.green}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#d97706' }}>
                              {l.yellow}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>
                              {l.red}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed' }}>
                              {l.purple}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#2563eb' }}>
                              {l.needs_transport}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' }}>le={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed' }}>
                                {l.purple}
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#2563eb' }}>
                                {l.needs_transport}
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#16a34a' }}>{pctGreen}%</span>
                                  <div style={{ width: '30px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${pctGreen}%`, height: '100%', background: '#16a34a' }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}

                {/* ── REPORT EMBEDDED FOOTER ── */}
                <div style={{
                  marginTop: '30px', borderTop: '1px solid #cbd5e1', paddingTop: '10px',
                  display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#64748b'
                }}>
                  <span>© {new Date().getFullYear()} Intelecciones. Todos los derechos reservados.</span>
                  <span>Documento de carácter estrictamente confidencial y de uso interno de campaña.</span>
                  <span>Pág. 1 de 1</span>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* Modals */}
      {showCreatePadrino && (
        <CreateUserModal
          defaultRole={user?.role === 'PADRINO' ? 'COORDINADOR' : 'PADRINO'}
          defaultParentId={isPadrino ? user?.id : undefined}
          campaigns={campaigns}
          onClose={() => setShowCreatePadrino(false)}
          onCreated={load}
        />
      )}
    </div>
  );
};

export default TeamPanel;
