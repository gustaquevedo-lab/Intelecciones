import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, ChevronDown, ChevronRight, Phone, Shield, UserCheck, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  needs_transport?: number;
}

interface Campaign { id: number; name: string; lists: any[]; }

const ROLE_COLORS: Record<string, string> = {
  PADRINO:      '#A855F7',
  COORDINADOR:  '#3B82F6',
  MIEMBRO_DE_MESA: '#F59E0B',
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
  const [form, setForm] = useState({
    nombre: '', ci: '', telefono: '', password: '',
    role: defaultRole,
    assigned_list_id: '',
    parent_id: defaultParentId?.toString() || '',
    assigned_campaign_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [padrinos, setPadrinos] = useState<TeamUser[]>([]);

  // Load padrinos for assigning coordinators
  useEffect(() => {
    if (defaultRole === 'COORDINADOR') {
      api.get('/my-team').then(r => setPadrinos(r.data.padrinos || [])).catch(() => {});
    }
  }, [defaultRole]);

  const allLists = campaigns.flatMap(c => c.lists.map((l: any) => ({ ...l, campaign_name: c.name })));

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
        password: form.password || form.ci.replace(/\./g, ''),
        role: form.role,
        nombre: form.nombre.trim(),
        ci: form.ci.replace(/\./g, ''),
        telefono: form.telefono || null,
        assigned_list_id: form.assigned_list_id ? parseInt(form.assigned_list_id) : null,
        assigned_campaign_id: form.assigned_campaign_id ? parseInt(form.assigned_campaign_id) : (user?.assigned_campaign_id || null),
        parent_id: form.parent_id ? parseInt(form.parent_id) : null,
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
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'white', fontSize: '0.88rem', fontWeight: 600, outline: 'none',
    boxSizing: 'border-box'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px',
        width: '100%', maxWidth: '480px', padding: '2rem', position: 'relative',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
          borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)'
        }}>
          <X size={16} />
        </button>

        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', marginBottom: '0.3rem' }}>
            Nuevo {form.role === 'PADRINO' ? 'Padrino' : form.role === 'COORDINADOR' ? 'Coordinador' : 'Miembro de Mesa'}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            La cédula será el usuario. La contraseña inicial es la cédula (el usuario la cambia al primer ingreso).
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Nombre completo *</label>
              <input style={inputStyle} placeholder="Ej: Juan Pérez" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
            </div>
            <div>
              <label style={labelStyle}>Cédula *</label>
              <input style={inputStyle} placeholder="Sin puntos" value={form.ci} onChange={e => setForm(f => ({ ...f, ci: e.target.value }))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input style={inputStyle} placeholder="0981..." value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Contraseña (opcional)</label>
              <input style={inputStyle} type="password" placeholder="Default: cédula" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Rol</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
              {user?.role === 'SUPERUSUARIO' && <option value="JEFE_CAMPANA">Jefe de Campaña</option>}
              {(user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA') && <option value="PADRINO">Padrino</option>}
              <option value="COORDINADOR">Coordinador</option>
              <option value="MIEMBRO_DE_MESA">Miembro de Mesa</option>
            </select>
          </div>

          {/* Lista asignada */}
          {allLists.length > 0 && (
            <div>
              <label style={labelStyle}>Lista asignada</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.assigned_list_id} onChange={e => {
                const listId = e.target.value;
                const list = allLists.find(l => l.id.toString() === listId);
                setForm(f => ({
                  ...f,
                  assigned_list_id: listId,
                  assigned_campaign_id: list?.campaign_id?.toString() || f.assigned_campaign_id
                }));
              }}>
                <option value="">Sin lista específica</option>
                {allLists.map(l => (
                  <option key={l.id} value={l.id}>
                    Lista {l.list_number}{l.candidate_alias ? ` — ${l.candidate_alias}` : ''} ({l.campaign_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Padrino superior (para coordinadores) */}
          {form.role === 'COORDINADOR' && padrinos.length > 0 && !defaultParentId && (
            <div>
              <label style={labelStyle}>Padrino responsable</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                <option value="">Sin padrino asignado</option>
                {padrinos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px', padding: '0.65rem 0.9rem'
            }}>
              <AlertCircle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--red)', fontWeight: 700 }}>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: '0.85rem', borderRadius: '12px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(255,255,255,0.08)' : 'var(--plra-300)',
            color: loading ? 'var(--text-3)' : 'white', fontWeight: 900, fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            transition: 'all 0.2s'
          }}>
            {loading ? <><Loader size={16} className="spin" /> Creando...</> : <><CheckCircle size={16} /> Crear Usuario</>}
          </button>
        </form>
      </div>
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
    setCoordinators([]); // force reload
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
          background: padrino.photo_url ? `url(${padrino.photo_url}) center/cover` : 'rgba(168,85,247,0.2)',
          border: '2px solid rgba(168,85,247,0.4)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
        }}>
          {!padrino.photo_url && '👤'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{padrino.nombre}</span>
            <RolePill role="PADRINO" />
            {padrino.status === 'INACTIVE' && <span style={{ fontSize: '0.58rem', color: 'var(--red)', fontWeight: 900 }}>INACTIVO</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>CI: {padrino.ci || padrino.username}</span>
            {padrino.telefono && <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>📞 {padrino.telefono}</span>}
            {padrino.list_number && <span style={{ fontSize: '0.7rem', color: '#A855F7', fontWeight: 700 }}>Lista {padrino.list_number}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700 }}>Coordinadores</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#A855F7' }}>{padrino.coordinator_count ?? 0}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700 }}>Capturas</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--green)' }}>{padrino.total_captures ?? 0}</div>
          </div>
          {expanded ? <ChevronDown size={18} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
          {/* Add coordinator button */}
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
              <Loader size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
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
                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                background: c.photo_url ? `url(${c.photo_url}) center/cover` : 'rgba(59,130,246,0.2)',
                border: '2px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem'
              }}>
                {!c.photo_url && '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'white' }}>{c.nombre}</span>
                  <RolePill role="COORDINADOR" />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
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
              <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
                <StatDot count={c.green || 0} color="#22C55E" />
                <StatDot count={c.yellow || 0} color="#EAB308" />
                <StatDot count={c.red || 0} color="#EF4444" />
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
  const { user } = useAuth();
  const [padrinos, setPadrinos] = useState<TeamUser[]>([]);
  const [myCoordinators, setMyCoordinators] = useState<TeamUser[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePadrino, setShowCreatePadrino] = useState(false);

  const isSuperOrJefe = user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA';
  const isPadrino = user?.role === 'PADRINO';

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
  }, []);

  useEffect(() => { load(); }, [load]);

  const allLists = campaigns.flatMap(c => c.lists.map((l: any) => ({ ...l, campaign_name: c.name })));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
      <Loader size={28} style={{ color: 'var(--plra-300)', animation: 'spin 1s linear infinite' }} />
      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 700 }}>Cargando equipo...</span>
    </div>
  );

  return (
    <div style={{ padding: 'clamp(1rem, 3vw, 2rem)', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
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
        {isSuperOrJefe && (
          <button onClick={() => setShowCreatePadrino(true)} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'var(--plra-300)', border: 'none', borderRadius: '12px',
            color: 'white', padding: '0.7rem 1.25rem',
            fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer', flexShrink: 0
          }}>
            <Plus size={16} /> Nuevo Padrino
          </button>
        )}
      </div>

      {/* Campaign/List summary pills */}
      {campaigns.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
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
            <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
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
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  background: c.photo_url ? `url(${c.photo_url}) center/cover` : 'rgba(59,130,246,0.2)',
                  border: '2px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {!c.photo_url && '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 800, color: 'white', fontSize: '0.9rem' }}>{c.nombre}</span>
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
                <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                  <StatDot count={c.green || 0} color="#22C55E" />
                  <StatDot count={c.yellow || 0} color="#EAB308" />
                  <StatDot count={c.red || 0} color="#EF4444" />
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Modals */}
      {showCreatePadrino && (
        <CreateUserModal
          defaultRole={isPadrino ? 'COORDINADOR' : 'PADRINO'}
          campaigns={campaigns}
          onClose={() => setShowCreatePadrino(false)}
          onCreated={load}
        />
      )}
    </div>
  );
};

export default TeamPanel;
