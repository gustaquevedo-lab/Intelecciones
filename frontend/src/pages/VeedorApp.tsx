import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, MapPin, CheckSquare, FileText, Upload, Camera, Send, AlertCircle, Plus, Minus } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface ListaVotos {
  lista_id: number;
  nombre: string;
  color: string;
  votos: number;
}

/* ─────────────────────────────────────────────
   TAB BUTTON
───────────────────────────────────────────── */
const TabBtn = ({
  active, icon: Icon, label, onClick
}: { active: boolean; icon: any; label: string; onClick: () => void }) => (
  <motion.button
    whileTap={{ scale: 0.96 }}
    onClick={onClick}
    style={{
      flex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
      padding: '0.65rem',
      borderRadius: '10px',
      border: 'none',
      background: active ? 'var(--plra-500)' : 'transparent',
      color: active ? 'white' : 'var(--text-3)',
      fontWeight: 700, fontSize: '0.75rem',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      cursor: 'pointer', transition: 'all 0.2s'
    }}
  >
    <Icon size={14} />
    {label}
  </motion.button>
);

/* ─────────────────────────────────────────────
   VEEDURÍA TAB (existing vote grid)
───────────────────────────────────────────── */
const VeeduriaTab = ({ user }: { user: any }) => {
  const [electors, setElectors] = useState<number[]>([]);
  const [votedOrders, setVotedOrders] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState<number | null>(null);
  const [tableInfo, setTableInfo] = useState({ local: '', mesa: '', total: 0 });

  useEffect(() => { loadTableData(); }, [user]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/veedor/table-status');
      setTableInfo(res.data.info);
      const voted = new Set<number>(res.data.votedOrders);
      setVotedOrders(voted);
      setElectors(Array.from({ length: res.data.info.total }, (_, i) => i + 1));
    } catch (err) {
      console.error('Error loading table data:', err);
    } finally {
      setLoading(false);
    }
  };

  const markVote = async (order: number) => {
    if (votedOrders.has(order)) return;
    
    // UI Feedback immediate
    setShowSuccess(order);
    setVotedOrders(prev => new Set(prev).add(order));
    setTimeout(() => setShowSuccess(null), 1000);

    try {
      const { safePost } = await import('../services/syncService');
      await safePost('MARK_VOTE', '/veedor/mark-vote', { order });
    } catch (err) {
      console.error('Error marking vote:', err);
    }
  };

  return (
    <>
      {/* Header táctico */}
      <header className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <MapPin size={14} style={{ color: tableInfo.local === 'SIN ASIGNACIÓN' ? 'var(--red)' : 'var(--plra-300)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text)' }}>
              {tableInfo.local || 'Cargando...'}
              {tableInfo.local === 'SIN ASIGNACIÓN' && (
                <span style={{ color: 'var(--red)', marginLeft: '0.5rem', fontSize: '0.7rem' }}>(CONTACTE COORDINADOR)</span>
              )}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700 }}>
              MESA: <span style={{ color: 'var(--plra-200)' }}>{tableInfo.mesa || '—'}</span>
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700 }}>
              TOTAL: <span style={{ color: 'var(--text)' }}>{tableInfo.total} electores</span>
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--green)' }}>
            {tableInfo.total > 0 ? Math.round((votedOrders.size / tableInfo.total) * 100) : 0}%
          </p>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Participación</p>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-3)' }}>Configurando mesa...</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
          gap: '0.5rem',
          background: 'var(--surface-light)',
          padding: '0.5rem',
          borderRadius: '12px'
        }}>
          {electors.map((order) => {
            const isVoted = votedOrders.has(order);
            return (
              <motion.button
                key={order}
                whileTap={{ scale: 0.9 }}
                onClick={() => markVote(order)}
                style={{
                  height: '60px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: '8px', border: '1px solid',
                  cursor: isVoted ? 'default' : 'pointer',
                  background: isVoted ? 'var(--plra-500)' : 'var(--surface-light)',
                  borderColor: isVoted ? 'var(--plra-300)' : 'var(--border)',
                  position: 'relative', transition: 'all 0.2s ease'
                }}
              >
                <span style={{
                  fontSize: '0.65rem', fontWeight: 900,
                  color: isVoted ? 'rgba(0,0,0,0.3)' : 'var(--text-3)',
                  position: 'absolute', top: '4px', left: '4px'
                }}>
                  #{order}
                </span>
                {isVoted ? (
                  <Check size={20} style={{ color: 'var(--white)' }} />
                ) : (
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{order}</span>
                )}
                <AnimatePresence>
                  {showSuccess === order && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 0 }}
                      animate={{ opacity: 1, scale: 1.5, y: -20 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      style={{
                        position: 'absolute', zIndex: 10,
                        background: 'var(--green)', borderRadius: '50%',
                        padding: '4px', boxShadow: '0 4px 15px rgba(34,197,94,0.4)'
                      }}
                    >
                      <Check size={20} color="var(--white)" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      )}
    </>
  );
};

/* ─────────────────────────────────────────────
   ACTA FINAL TAB
───────────────────────────────────────────── */
const ActaFinalTab = ({ user }: { user: any }) => {
  const [listas, setListas] = useState<ListaVotos[]>([]);
  const [votosEnBlanco, setVotosEnBlanco] = useState(0);
  const [votosNulos, setVotosNulos] = useState(0);
  const [totalElectores, setTotalElectores] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableInfo, setTableInfo] = useState({ local: '', mesa: '', mesa_id: null as number | null });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadActaData(); }, []);

  const loadActaData = async () => {
    try {
      setLoading(true);
      // Load listas and mesa info in parallel
      const [tableRes, listasRes] = await Promise.all([
        api.get('/veedor/table-status'),
        api.get('/diad/listas'),
      ]);
      setTableInfo({
        local: tableRes.data.info.local,
        mesa: tableRes.data.info.mesa,
        mesa_id: tableRes.data.info.mesa_id ?? null,
      });
      setTotalElectores(tableRes.data.info.total ?? 0);
      setListas(listasRes.data.map((l: any) => ({
        lista_id: l.id,
        nombre: l.nombre,
        color: l.color || '#5AACFF',
        votos: 0
      })));
    } catch (err) {
      console.error('Error loading acta data:', err);
      setError('No se pudieron cargar los datos del acta.');
    } finally {
      setLoading(false);
    }
  };

  const updateVotos = (lista_id: number, delta: number) => {
    setListas(prev => prev.map(l =>
      l.lista_id === lista_id
        ? { ...l, votos: Math.max(0, l.votos + delta) }
        : l
    ));
  };

  const setVotosDirecto = (lista_id: number, val: string) => {
    const n = parseInt(val) || 0;
    setListas(prev => prev.map(l =>
      l.lista_id === lista_id ? { ...l, votos: Math.max(0, n) } : l
    ));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const totalVotos = listas.reduce((s, l) => s + l.votos, 0) + votosEnBlanco + votosNulos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) { setError('Debes adjuntar la foto del acta.'); return; }
    if (totalVotos === 0) { setError('Ingresa al menos un voto para continuar.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('mesa_id', String(tableInfo.mesa_id ?? ''));
      formData.append('votos_blanco', String(votosEnBlanco));
      formData.append('votos_nulos', String(votosNulos));
      formData.append('total_electores', String(totalElectores));
      formData.append('listas', JSON.stringify(listas.map(l => ({ lista_id: l.lista_id, votos: l.votos }))));
      formData.append('foto_acta', photoFile);

      await api.post('/diad/acta', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al enviar el acta. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '5rem' }}>
      <div className="loading-spinner" style={{ margin: '0 auto' }} />
      <p style={{ marginTop: '1rem', color: 'var(--text-3)' }}>Cargando datos del acta...</p>
    </div>
  );

  if (submitted) return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card-premium-styled"
      style={{ padding: '3rem', textAlign: 'center', marginTop: '2rem' }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
        style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #22C47E, #1aab6d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 0 30px rgba(34,196,126,0.35)'
        }}
      >
        <Check size={36} color="var(--white)" strokeWidth={3} />
      </motion.div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.5rem' }}>
        Acta Enviada
      </h2>
      <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', maxWidth: '280px', margin: '0 auto' }}>
        Los resultados de la mesa <strong style={{ color: 'var(--plra-200)' }}>{tableInfo.mesa}</strong> fueron
        registrados correctamente. El sistema Día D ya los está procesando.
      </p>
      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(34,196,126,0.08)', borderRadius: '10px', border: '1px solid rgba(34,196,126,0.2)' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Total votos registrados
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--green)' }}>{totalVotos}</p>
      </div>
    </motion.div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {/* Mesa header */}
      <div className="card-premium-styled" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <MapPin size={16} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text)' }}>{tableInfo.local || 'Sin asignación'}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 700 }}>
            MESA <span style={{ color: 'var(--plra-200)' }}>{tableInfo.mesa || '—'}</span>
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Electores habilitados</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>{totalElectores}</p>
        </div>
      </div>

      {/* Votos por lista */}
      <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
          Votos por lista
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {listas.map(l => (
            <div key={l.lista_id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.7rem 0.9rem',
              background: 'var(--surface-light)',
              borderRadius: '10px',
              border: '1px solid var(--border)'
            }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: l.color, flexShrink: 0,
                boxShadow: `0 0 8px ${l.color}55`
              }} />
              <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{l.nombre}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => updateVotos(l.lista_id, -1)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Minus size={12} />
                </motion.button>
                <input
                  type="number"
                  min={0}
                  value={l.votos}
                  onChange={e => setVotosDirecto(l.lista_id, e.target.value)}
                  style={{
                    width: '56px', textAlign: 'center',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '7px', color: 'var(--text)',
                    fontSize: '0.9rem', fontWeight: 900, padding: '0.35rem',
                    outline: 'none'
                  }}
                />
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => updateVotos(l.lista_id, 1)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    border: '1px solid rgba(90,172,255,0.3)',
                    background: 'rgba(90,172,255,0.1)', color: 'var(--plra-200)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={12} />
                </motion.button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Votos en blanco / nulos */}
      <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
          Otros resultados
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {[
            { label: 'Votos en Blanco', value: votosEnBlanco, setter: setVotosEnBlanco, color: '#8B9DC3' },
            { label: 'Votos Nulos', value: votosNulos, setter: setVotosNulos, color: '#E05C5C' },
          ].map(({ label, value, setter, color }) => (
            <div key={label} style={{ padding: '0.9rem', background: 'var(--surface-light)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>{label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => setter(v => Math.max(0, v - 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Minus size={12} />
                </motion.button>
                <input
                  type="number" min={0} value={value}
                  onChange={e => setter(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', color, fontSize: '1.1rem', fontWeight: 900, padding: '0.35rem', outline: 'none' }}
                />
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => setter(v => v + 1)}
                  style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid rgba(90,172,255,0.3)', background: 'rgba(90,172,255,0.1)', color: 'var(--plra-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Plus size={12} />
                </motion.button>
              </div>
            </div>
          ))}
        </div>
        {/* Total summary */}
        <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(90,172,255,0.06)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total registrado</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--blue)' }}>{totalVotos}</span>
        </div>
      </div>

      {/* Foto del acta */}
      <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={13} />
          Foto del Acta Oficial
          <span style={{ color: 'var(--red)', marginLeft: '2px' }}>*</span>
        </h3>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />
        {photoPreview ? (
          <div style={{ position: 'relative' }}>
            <img
              src={photoPreview}
              alt="Vista previa del acta"
              style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '10px', border: '2px solid rgba(34,196,126,0.4)' }}
            />
            <motion.button
              type="button" whileTap={{ scale: 0.9 }}
              onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
              style={{
                position: 'absolute', top: '8px', right: '8px',
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '6px',
                color: 'white', padding: '4px 8px', fontSize: '0.7rem',
                fontWeight: 700, cursor: 'pointer'
              }}
            >
              Cambiar
            </motion.button>
          </div>
        ) : (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', padding: '2rem 1rem',
              border: '2px dashed var(--border)', borderRadius: '12px',
              background: 'var(--surface-light)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
              transition: 'all 0.2s'
            }}
          >
            <Upload size={28} style={{ color: 'var(--text-3)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Tomar foto del acta</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Asegurate que el documento sea legible</p>
            </div>
          </motion.button>
        )}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.75rem 1rem', background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)', borderRadius: '10px', marginBottom: '1rem' }}
        >
          <AlertCircle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ color: 'var(--red)', fontSize: '0.82rem', fontWeight: 600 }}>{error}</p>
        </motion.div>
      )}

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={submitting}
        whileHover={!submitting ? { scale: 1.02 } : {}}
        whileTap={!submitting ? { scale: 0.97 } : {}}
        style={{
          width: '100%', padding: '1rem',
          borderRadius: '12px', border: 'none',
          background: submitting
            ? 'rgba(34,196,126,0.3)'
            : 'linear-gradient(135deg, #22C47E 0%, #1aab6d 100%)',
          color: 'var(--white)', fontWeight: 900, fontSize: '0.9rem',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          cursor: submitting ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
          boxShadow: submitting ? 'none' : '0 4px 20px rgba(34,196,126,0.3)',
          transition: 'all 0.2s',
          marginBottom: '2rem'
        }}
      >
        {submitting ? (
          <>
            <div className="spinner" />
            Enviando Acta...
          </>
        ) : (
          <>
            <Send size={16} />
            Cerrar Mesa y Enviar Acta
          </>
        )}
      </motion.button>
    </form>
  );
};

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const VeedorApp = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'veeduria' | 'acta'>('veeduria');

  return (
    <MainLayout title="Control de Veeduría" userName={user?.nombre || 'Veedor'}>
      <div style={{ padding: '1rem', maxWidth: '720px', margin: '0 auto', paddingBottom: '5rem' }}>

        {/* Tab selector */}
        <div style={{
          display: 'flex', gap: '0.25rem',
          background: 'rgba(0,0,0,0.25)', padding: '0.25rem',
          borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
          marginBottom: '1.5rem'
        }}>
          <TabBtn
            active={activeTab === 'veeduria'}
            icon={CheckSquare}
            label="Veeduría"
            onClick={() => setActiveTab('veeduria')}
          />
          <TabBtn
            active={activeTab === 'acta'}
            icon={FileText}
            label="Acta Final"
            onClick={() => setActiveTab('acta')}
          />
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'veeduria' ? (
            <motion.div
              key="veeduria"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
            >
              <VeeduriaTab user={user} />
            </motion.div>
          ) : (
            <motion.div
              key="acta"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <ActaFinalTab user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
};

export default VeedorApp;
