import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, CheckSquare, Check, Minus, Plus, Camera, Upload, Send, FileText 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface ListaVotos {
  lista_id: number;
  nombre: string;
  color: string;
  votos: number;
}

const TabBtn = ({ active, icon: Icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      padding: '0.75rem',
      borderRadius: '12px',
      border: 'none',
      background: active ? 'var(--plra-500)' : 'transparent',
      color: active ? 'white' : 'var(--text-3)',
      fontWeight: 800,
      fontSize: '0.85rem',
      transition: 'all 0.2s',
      cursor: 'pointer'
    }}
  >
    <Icon size={18} />
    {label}
  </button>
);

/* ─────────────────────────────────────────────
   VEEDURÍA TAB (optimized for mobile)
   ───────────────────────────────────────────── */
const VeeduriaTab = ({ user, onFinish }: { user: any; onFinish?: () => void }) => {
  const [electors, setElectors] = useState<number[]>([]);
  const [votedOrders, setVotedOrders] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState<number | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<number | null>(null);
  const [tableInfo, setTableInfo] = useState({ local: '', mesa: '', total: 0 });

  const isMiembroMesa = user?.role === 'MIEMBRO_DE_MESA';

  useEffect(() => {
    if (user) loadTableData();
  }, [user]);

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

  const handleMarkRequest = (order: number) => {
    if (votedOrders.has(order)) return;
    setConfirmingOrder(order);
  };

  const confirmMarkVote = async () => {
    if (!confirmingOrder) return;
    const order = confirmingOrder;
    
    // UI Feedback immediate
    setShowSuccess(order);
    setVotedOrders(prev => new Set(prev).add(order));
    setConfirmingOrder(null);
    
    setTimeout(() => setShowSuccess(null), 1500);

    try {
      const { safePost } = await import('../services/syncService');
      await safePost('MARK_VOTE', '/veedor/mark-vote', { order });
    } catch (err) {
      console.error('Error marking vote:', err);
    }
  };

  const hasAssignment = tableInfo?.local && tableInfo.local !== 'SIN ASIGNACIÓN';

  if (!hasAssignment && !loading && (user?.role === 'MIEMBRO_DE_MESA' || user?.role === 'VEEDOR')) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
           <MapPin size={40} style={{ color: 'var(--text-3)' }} />
        </div>
        <h3 style={{ color: 'white', fontWeight: 800 }}>Sin Mesa Asignada</h3>
        <p style={{ fontSize: '0.9rem' }}>Aún no tienes un local o mesa de votación asignada en el sistema.</p>
        <p style={{ fontSize: '0.75rem', marginTop: '1rem', opacity: 0.7 }}>Contacta a tu coordinador para que asigne tu local y mesa.</p>
      </div>
    );
  }

  return (
    <>
      {/* Header táctico optimizado */}
      <header className="card-premium-styled" style={{ 
        padding: '1.25rem', 
        marginBottom: '1rem', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <MapPin size={16} style={{ color: tableInfo.local === 'SIN ASIGNACIÓN' ? 'var(--red)' : 'var(--plra-300)' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>
                {tableInfo.local || 'Cargando...'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 800 }}>
                MESA: <span style={{ color: 'var(--plra-200)', fontSize: '1rem' }}>{tableInfo.mesa || '—'}</span>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 800 }}>
                TOTAL: <span style={{ color: 'var(--text)', fontSize: '1rem' }}>{tableInfo.total}</span>
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--green)', lineHeight: 1 }}>
              {votedOrders.size}
            </p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Presentes</p>
          </div>
        </div>

        {isMiembroMesa && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (window.confirm('¿Está seguro de CERRAR LA VOTACIÓN? Una vez cerrada, deberá cargar el acta final.')) {
                onFinish?.();
              }
            }}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
              color: 'white',
              fontWeight: 900,
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
            }}
          >
            <CheckSquare size={20} />
            Cerrar Votación
          </motion.button>
        )}
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-3)' }}>Configurando mesa...</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))',
          gap: '0.75rem',
          paddingBottom: '2rem'
        }}>
          {electors.map((order) => {
            const isVoted = votedOrders.has(order);
            return (
              <motion.button
                key={order}
                whileTap={{ scale: 0.85 }}
                onClick={() => handleMarkRequest(order)}
                style={{
                  height: '90px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: '16px', border: '2px solid',
                  cursor: isVoted ? 'default' : 'pointer',
                  background: isVoted ? 'var(--plra-600)' : 'rgba(255,255,255,0.03)',
                  borderColor: isVoted ? 'var(--plra-400)' : 'rgba(255,255,255,0.08)',
                  position: 'relative', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isVoted ? 'none' : '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <span style={{
                  fontSize: '0.75rem', fontWeight: 900,
                  color: isVoted ? 'rgba(255,255,255,0.3)' : 'var(--text-3)',
                  position: 'absolute', top: '8px', left: '10px'
                }}>
                  #{order}
                </span>
                
                {isVoted ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Check size={32} style={{ color: 'var(--white)' }} strokeWidth={3} />
                  </motion.div>
                ) : (
                  <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white' }}>{order}</span>
                )}

                <AnimatePresence>
                  {showSuccess === order && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 0 }}
                      animate={{ opacity: 1, scale: 2, y: -40 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      style={{
                        position: 'absolute', zIndex: 10,
                        background: 'var(--green)', borderRadius: '50%',
                        padding: '8px', boxShadow: '0 8px 25px rgba(34,197,94,0.6)'
                      }}
                    >
                      <Check size={24} color="var(--white)" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE VOTO */}
      <AnimatePresence>
        {confirmingOrder && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '2rem'
          }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                width: '100%', maxWidth: '320px',
                background: 'var(--surface-light)', borderRadius: '24px',
                padding: '2rem', textAlign: 'center',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '50%', 
                background: 'rgba(59,130,246,0.1)', color: '#3B82F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>{confirmingOrder}</span>
              </div>
              
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>
                Confirmar Voto
              </h3>
              <p style={{ color: 'var(--text-3)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                ¿Desea marcar como presente al elector número <strong>#{confirmingOrder}</strong>?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={confirmMarkVote}
                  style={{
                    padding: '1.25rem', borderRadius: '16px', border: 'none',
                    background: 'var(--green)', color: 'white',
                    fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem'
                  }}
                >
                  <Check size={24} strokeWidth={3} />
                  SÍ, CONFIRMAR
                </motion.button>
                
                <button
                  onClick={() => setConfirmingOrder(null)}
                  style={{
                    padding: '1rem', background: 'transparent', border: 'none',
                    color: 'var(--text-3)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer'
                  }}
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ─────────────────────────────────────────────
   ACTA FINAL TAB (optimized)
   ───────────────────────────────────────────── */
const ActaFinalTab = () => {
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
    </motion.div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {/* Mesa header */}
      <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <MapPin size={20} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>{tableInfo.local || 'Sin asignación'}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 800 }}>
            MESA <span style={{ color: 'var(--plra-200)', fontSize: '1.1rem' }}>{tableInfo.mesa || '—'}</span>
          </p>
        </div>
      </div>

      {/* Votos por lista */}
      <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>
          Votos por lista
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {listas.map(l => (
            <div key={l.lista_id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.9rem 1rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '16px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: 'white' }}>{l.nombre}</span>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700 }}>LISTA {l.lista_id}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => updateVotos(l.lista_id, -1)}
                  style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.05)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Minus size={18} strokeWidth={3} />
                </motion.button>
                <input
                  type="number"
                  min={0}
                  value={l.votos}
                  onChange={e => setVotosDirecto(l.lista_id, e.target.value)}
                  style={{
                    width: '65px', textAlign: 'center',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', color: 'white',
                    fontSize: '1.4rem', fontWeight: 900, padding: '0.4rem',
                    outline: 'none'
                  }}
                />
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => updateVotos(l.lista_id, 1)}
                  style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    border: 'none',
                    background: 'var(--plra-500)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,71,171,0.3)'
                  }}
                >
                  <Plus size={18} strokeWidth={3} />
                </motion.button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Otros resultados - BLANCOS Y NULOS - Gigantes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Blancos', value: votosEnBlanco, setter: setVotosEnBlanco, color: '#94A3B8' },
            { label: 'Nulos', value: votosNulos, setter: setVotosNulos, color: '#EF4444' },
          ].map(({ label, value, setter, color }) => (
            <div key={label} className="card-premium-styled" style={{ padding: '1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>{label}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <motion.button
                  type="button" whileTap={{ scale: 0.8 }}
                  onClick={() => setter(v => Math.max(0, v - 1))}
                  style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Minus size={14} strokeWidth={3} />
                </motion.button>
                <span style={{ fontSize: '1.8rem', fontWeight: 900, color, minWidth: '40px' }}>{value}</span>
                <motion.button
                  type="button" whileTap={{ scale: 0.8 }}
                  onClick={() => setter(v => v + 1)}
                  style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={14} strokeWidth={3} />
                </motion.button>
              </div>
            </div>
          ))}
      </div>

      {/* Foto del acta */}
      <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={16} /> Foto del Acta Oficial
        </h3>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: 'none' }} />
        {photoPreview ? (
          <div style={{ position: 'relative' }}>
            <img src={photoPreview} alt="Vista previa" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '16px', border: '2px solid var(--green)' }} />
            <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '8px', color: 'white', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 800 }}>
              CAMBIAR FOTO
            </motion.button>
          </div>
        ) : (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()}
            style={{ width: '100%', padding: '2.5rem 1rem', border: '2px dashed var(--border)', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Upload size={36} style={{ color: 'var(--plra-300)' }} />
            <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white' }}>CAPTURAR ACTA</p>
          </motion.button>
        )}
      </div>
      
      {error && (
        <div style={{ 
          padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', 
          borderRadius: '12px', color: '#F87171', fontSize: '0.85rem', fontWeight: 700, 
          marginBottom: '1.5rem', textAlign: 'center' 
        }}>
          {error}
        </div>
      )}

      {/* Submit Button - GIGANTE */}
      <motion.button
        type="submit"
        disabled={submitting}
        whileTap={{ scale: 0.95 }}
        style={{
          width: '100%', padding: '1.25rem',
          borderRadius: '18px', border: 'none',
          background: submitting ? 'var(--text-3)' : 'linear-gradient(135deg, #22C47E 0%, #16a34a 100%)',
          color: 'white', fontWeight: 900, fontSize: '1.1rem',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
          boxShadow: '0 8px 30px rgba(22, 163, 74, 0.4)',
          marginBottom: '3rem'
        }}
      >
        {submitting ? 'Enviando...' : <><Send size={20} /> ENVIAR RESULTADOS</>}
      </motion.button>
    </form>
  );
};

/* ─────────────────────────────────────────────
   MAIN APP COMPONENT
   ───────────────────────────────────────────── */
const VeedorApp = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'veeduria' | 'acta'>('veeduria');
  const isMiembroMesa = user?.role === 'MIEMBRO_DE_MESA';



  return (
    <MainLayout title="Panel de Mesa" userName={user?.nombre || 'Veedor'}>
      <div style={{ 
        padding: '1rem', 
        maxWidth: '500px', 
        margin: '0 auto', 
        minHeight: 'calc(100vh - 70px)',
        display: 'flex',
        flexDirection: 'column'
      }}>

        {/* Tab selector - HIDDEN for Miembro de Mesa if they haven't finished */}
        {!isMiembroMesa && (
          <div style={{
            display: 'flex', gap: '0.5rem',
            background: 'rgba(0,0,0,0.3)', padding: '0.35rem',
            borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)',
            marginBottom: '1.25rem'
          }}>
            <TabBtn active={activeTab === 'veeduria'} icon={CheckSquare} label="Veeduría" onClick={() => setActiveTab('veeduria')} />
            <TabBtn active={activeTab === 'acta'} icon={FileText} label="Acta Final" onClick={() => setActiveTab('acta')} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'veeduria' ? (
            <motion.div key="veeduria" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <VeeduriaTab 
                user={user} 
                onFinish={() => setActiveTab('acta')} 
              />
            </motion.div>
          ) : (
            <motion.div key="acta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ActaFinalTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
};

export default VeedorApp;
