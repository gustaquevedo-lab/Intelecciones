import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MapPin, CheckSquare, Check, Minus, Plus, Camera, Upload, Send, FileText,
  Users, RefreshCw, X, AlertOctagon, HelpCircle, QrCode, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5QrcodeScanner } from 'html5-qrcode';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/Skeleton';
import api, { getImageUrl } from '../services/api';
import { startSiren, stopSiren } from '../utils/sirenAudio';
import { useSSE } from '../hooks/useSSE';

interface ListaVotos {
  lista_id: number;
  nombre: string;
  color: string;
  votos: number;
  type?: string;
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
   MAIN APP COMPONENT
   ───────────────────────────────────────────── */
const VeedorApp = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'veeduria' | 'acta'>('veeduria');
  const isMiembroMesa = user?.role === 'MIEMBRO_DE_MESA';
  const isApoderado = user?.role === 'APODERADO';
  const isSupervisor = true;

  const [localesMesas, setLocalesMesas] = useState<{ nombre: string; mesas: number[] }[]>([]);
  const [selectedLocal, setSelectedLocal] = useState<string>(() => localStorage.getItem('veedor_selected_local') || user?.assigned_local || '');
  const [selectedMesa, setSelectedMesa] = useState<number>(() => {
    const saved = localStorage.getItem('veedor_selected_mesa');
    return saved ? parseInt(saved) : (user?.assigned_mesa || 0);
  });

  useEffect(() => {
    if (isSupervisor) {
      api.get('/veedor/locales-mesas')
        .then(res => {
          setLocalesMesas(res.data);
          if (res.data.length > 0) {
            const savedLocal = localStorage.getItem('veedor_selected_local');
            const savedMesa = localStorage.getItem('veedor_selected_mesa');
            
            // Try to match saved or user assignment, case-insensitive
            let initialLocal = savedLocal || user?.assigned_local || '';
            let matched = res.data.find((l: any) => l.nombre.trim().toUpperCase() === initialLocal.trim().toUpperCase());
            
            let finalLocal = matched ? matched.nombre : res.data[0].nombre;
            let finalMesa = 1;
            
            if (matched) {
              const parsedMesa = parseInt(savedMesa || '');
              if (!isNaN(parsedMesa) && matched.mesas.includes(parsedMesa)) {
                finalMesa = parsedMesa;
              } else if (user?.assigned_mesa && matched.mesas.includes(user.assigned_mesa)) {
                finalMesa = user.assigned_mesa;
              } else {
                finalMesa = matched.mesas[0] || 1;
              }
            } else {
              finalMesa = res.data[0].mesas[0] || 1;
            }

            setSelectedLocal(finalLocal);
            setSelectedMesa(finalMesa);
            localStorage.setItem('veedor_selected_local', finalLocal);
            localStorage.setItem('veedor_selected_mesa', String(finalMesa));
          }
        })
        .catch(err => console.error(err));
    }
  }, [isSupervisor, user]);

  if (isApoderado) {
    return <ApoderadoPanel user={user} />;
  }

  return (
    <MainLayout title="Panel de Mesa" userName={user?.nombre || 'Veedor'}>
      <div style={{ 
        padding: '1rem', 
        maxWidth: '800px', 
        margin: '0 auto', 
        minHeight: 'calc(100vh - 70px)',
        display: 'flex',
        flexDirection: 'column'
      }}>

        {/* Supervisor Selectors */}
        {isSupervisor && localesMesas.length > 0 && (
          <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--plra-300)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Selector de Local y Mesa (Supervisión)
            </h3>
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'row', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 250px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.4rem', fontWeight: 700 }}>LOCAL DE VOTACIÓN</label>
                <select
                  value={selectedLocal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedLocal(val);
                    localStorage.setItem('veedor_selected_local', val);
                    const locObj = localesMesas.find(l => l.nombre === val);
                    if (locObj && locObj.mesas.length > 0) {
                      setSelectedMesa(locObj.mesas[0]);
                      localStorage.setItem('veedor_selected_mesa', String(locObj.mesas[0]));
                    }
                  }}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    color: 'white', fontWeight: 700, outline: 'none'
                  }}
                >
                  {localesMesas.map(l => (
                    <option key={l.nombre} value={l.nombre} style={{ background: 'var(--bg-card)', color: 'white' }}>{l.nombre}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.4rem', fontWeight: 700 }}>MESA</label>
                <select
                  value={selectedMesa}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSelectedMesa(val);
                    localStorage.setItem('veedor_selected_mesa', String(val));
                  }}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    color: 'white', fontWeight: 700, outline: 'none'
                  }}
                >
                  {(localesMesas.find(l => l.nombre === selectedLocal)?.mesas || [1]).map(m => (
                    <option key={m} value={m} style={{ background: 'var(--bg-card)', color: 'white' }}>Mesa {m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

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
                selectedLocal={selectedLocal}
                selectedMesa={selectedMesa}
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


/* ─────────────────────────────────────────────
   ELECTOR GRID ITEM COMPONENT (battery optimized)
   ───────────────────────────────────────────── */
const ElectorGridItem = React.memo(({ order, isVoted, onClick }: {
  order: number;
  isVoted: boolean;
  onClick: (order: number) => void;
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(order)}
      style={{
        height: '80px',
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        borderRadius: '14px', 
        border: '2px solid',
        cursor: 'pointer',
        background: isVoted ? 'var(--plra-600)' : 'rgba(255,255,255,0.03)',
        borderColor: isVoted ? 'var(--plra-400)' : 'rgba(255,255,255,0.08)',
        position: 'relative', 
        transition: 'transform 0.1s ease-in-out, background-color 0.15s, border-color 0.15s',
        boxShadow: isVoted ? 'none' : '0 4px 10px rgba(0,0,0,0.15)',
        width: '100%',
        color: 'white',
        outline: 'none'
      }}
      className="elector-grid-item"
    >
      {isVoted ? (
        <Check size={28} style={{ color: 'var(--white)' }} strokeWidth={3.5} />
      ) : (
        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{order}</span>
      )}
    </button>
  );
});

/* ─────────────────────────────────────────────
   VEEDURÍA TAB (optimized for mobile & desktop)
   ───────────────────────────────────────────── */
const VeeduriaTab = ({ user, onFinish, selectedLocal, selectedMesa }: { 
  user: any; 
  onFinish?: () => void;
  selectedLocal?: string;
  selectedMesa?: number;
}) => {
  const [electors, setElectors] = useState<number[]>([]);
  const [votedOrders, setVotedOrders] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState<number | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<number | null>(null);
  const [unconfirmingOrder, setUnconfirmingOrder] = useState<number | null>(null);
  const [tableInfo, setTableInfo] = useState({ local: '', mesa: '', total: 0 });
  const [customTotal, setCustomTotal] = useState<number>(400);
  const [searchQuery, setSearchQuery] = useState('');

  const isMiembroMesa = user?.role === 'MIEMBRO_DE_MESA';

  useEffect(() => {
    if (user) loadTableData();
  }, [user, selectedLocal, selectedMesa]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      const activeLocal = selectedLocal || user?.assigned_local;
      const activeMesa = selectedMesa || user?.assigned_mesa || 1;
      
      const url = activeLocal
        ? `/veedor/table-status?local=${encodeURIComponent(activeLocal)}&mesa=${activeMesa}`
        : '/veedor/table-status';
      const res = await api.get(url);
      setTableInfo(res.data.info);
      const voted = new Set<number>(res.data.votedOrders);
      setVotedOrders(voted);

      const storageKey = `veedor_total_${activeLocal || res.data.info.local}_${activeMesa || res.data.info.mesa}`;
      const savedTotal = localStorage.getItem(storageKey);
      const initialTotal = savedTotal ? parseInt(savedTotal) : (res.data.info.total || 400);
      setCustomTotal(initialTotal);
      setElectors(Array.from({ length: initialTotal }, (_, i) => i + 1));
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTotal = (newTotal: number) => {
    const val = Math.max(1, newTotal);
    setCustomTotal(val);
    setElectors(Array.from({ length: val }, (_, i) => i + 1));
    const storageKey = `veedor_total_${selectedLocal || tableInfo.local}_${selectedMesa || tableInfo.mesa}`;
    localStorage.setItem(storageKey, String(val));
  };

  const handleMarkRequest = (order: number) => {
    if (votedOrders.has(order)) {
      setUnconfirmingOrder(order);
    } else {
      setConfirmingOrder(order);
    }
  };

  const confirmMarkVote = async () => {
    if (!confirmingOrder) return;
    const order = confirmingOrder;
    
    setShowSuccess(order);
    setVotedOrders(prev => new Set(prev).add(order));
    setConfirmingOrder(null);
    
    setTimeout(() => setShowSuccess(null), 1500);

    try {
      const { safePost } = await import('../services/syncService');
      await safePost('MARK_VOTE', '/veedor/mark-vote', { 
        order,
        local: selectedLocal || tableInfo.local,
        mesa: selectedMesa || tableInfo.mesa
      });
    } catch (err) {
    }
  };

  const confirmUnmarkVote = async () => {
    if (!unconfirmingOrder) return;
    const order = unconfirmingOrder;
    
    setVotedOrders(prev => {
      const next = new Set(prev);
      next.delete(order);
      return next;
    });
    setUnconfirmingOrder(null);

    try {
      const { safePost } = await import('../services/syncService');
      await safePost('UNMARK_VOTE', '/veedor/unmark-vote', { 
        order,
        local: selectedLocal || tableInfo.local,
        mesa: selectedMesa || tableInfo.mesa
      });
    } catch (err) {
    }
  };

  const hasAssignment = tableInfo?.local && tableInfo.local !== 'SIN ASIGNACIÓN';

  if (!hasAssignment && !loading && (user?.role === 'MIEMBRO_DE_MESA' || user?.role === 'VEEDOR')) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-3)' }}>
        <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
           <MapPin size={44} style={{ color: 'var(--text-3)' }} />
        </div>
        <h3 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>Sin Mesa Asignada</h3>
        <p style={{ fontSize: '1rem', marginTop: '0.5rem' }}>Aún no tienes un local o mesa de votación asignada en el sistema.</p>
        <p style={{ fontSize: '0.85rem', marginTop: '1.25rem', opacity: 0.7 }}>Contacta a tu coordinador para que asigne tu local y mesa.</p>
      </div>
    );
  }

  // Filter grid by search query
  const filteredElectors = electors.filter(e => {
    if (!searchQuery) return true;
    return String(e).includes(searchQuery);
  });

  return (
    <>
      {/* Header táctico optimizado */}
      <header className="card-premium-styled" style={{ 
        padding: '1.5rem', 
        marginBottom: '1.25rem', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <MapPin size={18} style={{ color: tableInfo.local === 'SIN ASIGNACIÓN' ? 'var(--red)' : 'var(--plra-300)' }} />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.2 }}>
                {tableInfo.local || 'Cargando...'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <p style={{ fontSize: '1rem', color: 'var(--text-3)', fontWeight: 800 }}>
                MESA: <span style={{ color: 'var(--plra-200)', fontSize: '1.2rem', fontWeight: 900 }}>{tableInfo.mesa || '—'}</span>
              </p>
              <div style={{ fontSize: '1.0rem', color: 'var(--text-3)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                TOTAL: 
                <button 
                  type="button" 
                  onClick={() => handleUpdateTotal(customTotal - 10)}
                  style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: '0.75rem' }}
                >
                  -10
                </button>
                <input
                  type="number"
                  value={customTotal}
                  onChange={(e) => handleUpdateTotal(parseInt(e.target.value) || 0)}
                  style={{
                    width: '65px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px', color: 'white', fontWeight: 900, fontSize: '1.1rem', padding: '0.2rem 0', outline: 'none'
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => handleUpdateTotal(customTotal + 10)}
                  style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: '0.75rem' }}
                >
                  +10
                </button>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--green)', lineHeight: 1 }}>
              {votedOrders.size}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presentes</p>
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
              padding: '1.2rem',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
              color: 'white',
              fontWeight: 900,
              fontSize: '1.05rem',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
            }}
          >
            <CheckSquare size={22} />
            Cerrar Votación
          </motion.button>
        )}
      </header>

      {/* Quick Search / Marker Bar */}
      <div className="card-premium-styled" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <input
            type="number"
            placeholder="Buscar o Marcar Nº de Orden..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
              color: 'white', fontWeight: 700, outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {/^\d+$/.test(searchQuery) && parseInt(searchQuery) > 0 && parseInt(searchQuery) <= customTotal && (
          <button
            type="button"
            onClick={() => {
              const orderNum = parseInt(searchQuery);
              handleMarkRequest(orderNum);
              setSearchQuery('');
            }}
            style={{
              padding: '0.75rem 1.25rem', borderRadius: '12px', border: 'none',
              background: votedOrders.has(parseInt(searchQuery)) ? 'var(--red)' : 'var(--green)',
              color: 'white', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {votedOrders.has(parseInt(searchQuery)) ? 'DESMARCAR' : 'MARCAR'} #{searchQuery}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '1rem' }}>
          <Skeleton height={110} borderRadius={18} style={{ marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.6rem' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} height={80} borderRadius={14} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
          gap: '0.6rem',
          paddingBottom: '2.5rem'
        }}>
          {filteredElectors.map((order) => {
            const isVoted = votedOrders.has(order);
            return (
              <div key={order} style={{ position: 'relative' }}>
                <ElectorGridItem 
                  order={order}
                  isVoted={isVoted}
                  onClick={handleMarkRequest}
                />
                
                <AnimatePresence>
                  {showSuccess === order && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 0 }}
                      animate={{ opacity: 1, scale: 1.6, y: -25 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      style={{
                        position: 'absolute', 
                        zIndex: 10,
                        top: '15px', 
                        left: '15px',
                        background: 'var(--green)', 
                        borderRadius: '50%',
                        padding: '6px', 
                        boxShadow: '0 8px 25px rgba(34,197,94,0.6)',
                        pointerEvents: 'none'
                      }}
                    >
                      <Check size={18} color="var(--white)" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                width: '100%', maxWidth: '340px',
                background: 'var(--surface-light)', borderRadius: '24px',
                padding: '2.2rem', textAlign: 'center',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ 
                width: '90px', height: '90px', borderRadius: '50%', 
                background: 'rgba(59,130,246,0.1)', color: '#3B82F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <span style={{ fontSize: '2.8rem', fontWeight: 900 }}>{confirmingOrder}</span>
              </div>
              
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', marginBottom: '0.6rem' }}>
                Confirmar Voto
              </h3>
              <p style={{ color: 'var(--text-2)', fontSize: '1rem', marginBottom: '2.2rem' }}>
                ¿Desea marcar como presente al elector número <strong style={{ color: 'white' }}>#{confirmingOrder}</strong>?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={confirmMarkVote}
                  style={{
                    padding: '1.35rem', borderRadius: '18px', border: 'none',
                    background: 'var(--green)', color: 'white',
                    fontWeight: 900, fontSize: '1.2rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem'
                  }}
                >
                  <Check size={26} strokeWidth={3.5} />
                  SÍ, CONFIRMAR
                </motion.button>
                
                <button
                  onClick={() => setConfirmingOrder(null)}
                  style={{
                    padding: '1rem', background: 'transparent', border: 'none',
                    color: 'var(--text-3)', fontWeight: 800, fontSize: '1rem', cursor: 'pointer'
                  }}
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN DE QUITAR VOTO */}
      <AnimatePresence>
        {unconfirmingOrder && (
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
                width: '100%', maxWidth: '340px',
                background: 'var(--surface-light)', borderRadius: '24px',
                padding: '2.2rem', textAlign: 'center',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ 
                width: '90px', height: '90px', borderRadius: '50%', 
                background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <span style={{ fontSize: '2.8rem', fontWeight: 900 }}>{unconfirmingOrder}</span>
              </div>
              
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', marginBottom: '0.6rem' }}>
                Quitar Voto
              </h3>
              <p style={{ color: 'var(--text-2)', fontSize: '1rem', marginBottom: '2.2rem' }}>
                ¿Desea desmarcar (quitar) al elector número <strong style={{ color: 'white' }}>#{unconfirmingOrder}</strong>?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={confirmUnmarkVote}
                  style={{
                    padding: '1.35rem', borderRadius: '18px', border: 'none',
                    background: 'var(--red)', color: 'white',
                    fontWeight: 900, fontSize: '1.2rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem'
                  }}
                >
                  <Check size={26} strokeWidth={3.5} />
                  SÍ, QUITAR
                </motion.button>
                
                <button
                  onClick={() => setUnconfirmingOrder(null)}
                  style={{
                    padding: '1rem', background: 'transparent', border: 'none',
                    color: 'var(--text-3)', fontWeight: 800, fontSize: '1rem', cursor: 'pointer'
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
  const [votosEnBlanco, setVotosEnBlanco] = useState<Record<string, number>>({});
  const [votosNulos, setVotosNulos] = useState<Record<string, number>>({});
  const [totalElectores, setTotalElectores] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<Record<string, File | null>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCategories, setSubmittedCategories] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableInfo, setTableInfo] = useState({ local: '', mesa: '', mesa_id: null as number | null });
  const fileRef = useRef<HTMLInputElement>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerPasteData, setScannerPasteData] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);


  const handleParseQRData = async (rawText: string) => {
    try {
      const res = await api.post('/veedor/parse-qr', { qrData: rawText });
      const data = res.data;
      if (data && data.success) {
        // 1. Reload the lists from backend so any auto-created adversary lists show up in the UI
        const listasRes = await api.get('/diad/listas');
        const updatedListas = listasRes.data.map((l: any) => {
          const voteCount = data.votos[l.id] ?? data.votos[String(l.id)] ?? data.votos[l.list_number] ?? data.votos[String(l.list_number)] ?? 0;
          return {
            lista_id: l.id,
            nombre: l.nombre,
            color: l.color || '#5AACFF',
            votos: voteCount
          };
        });
        setListas(updatedListas);

        if (data.blancos !== undefined) setVotosEnBlanco(data.blancos);
        if (data.nulos !== undefined) setVotosNulos(data.nulos);
        setShowQRScanner(false);
        setError('');
        alert(`✅ Datos del QR TSJE importados correctamente (Mesa ${data.mesa || tableInfo.mesa}). Verifique los campos antes de enviar.`);
      } else {
        alert('⚠️ No se pudieron extraer los resultados de este QR. Cargue manualmente.');
      }
    } catch (e: any) {
      alert('⚠️ Error al decodificar el formato del QR: ' + (e.response?.data?.error || e.message));
    }
  };

  useEffect(() => {
    if (showQRScanner) {
      setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner(
            'veedor-qr-reader',
            {
              fps: 15,
              qrbox: { width: 300, height: 300 },
              rememberLastUsedCamera: true,
              aspectRatio: 1.0,
              videoConstraints: { facingMode: "environment" }
            },
            false
          );
          scanner.render(
            (decodedText) => {
              handleParseQRData(decodedText);
              scanner.clear().catch(console.error);
              setShowQRScanner(false);
            },
            (err) => {}
          );
          scannerRef.current = scanner;
        } catch (err) {
          console.error('Failed to start scanner:', err);
        }
      }, 300);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error(err));
        scannerRef.current = null;
      }
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error(err));
      }
    };
  }, [showQRScanner]);

  useEffect(() => { loadActaData(); }, []);

  const loadActaData = async () => {
    try {
      setLoading(true);
      const tableRes = await api.get('/veedor/table-status');
      const listasRes = await api.get('/diad/listas');
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
        votos: 0,
        type: l.type || 'AUTORIDADES'
      })));
    } catch (err) {
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, cat: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFiles(prev => ({ ...prev, [cat]: file }));
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreviews(prev => ({ ...prev, [cat]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleCategorySubmit = async (e: React.FormEvent, cat: string) => {
    e.preventDefault();
    const catPhoto = photoFiles[cat];
    if (!catPhoto) { setError('Debes adjuntar la foto del acta para continuar.'); return; }
    
    const catListas = listas.filter(l => l.type === cat);
    const catListasPayload = catListas.map(l => ({ lista_id: l.lista_id, votos: l.votos }));

    setSubmitting(true);
    setError('');

    try {
      if (navigator.onLine) {
        const formData = new FormData();
        formData.append('mesa_id', String(tableInfo.mesa_id ?? ''));
        formData.append('votos_blanco', String(votosEnBlanco[cat] || 0));
        formData.append('votos_nulos', String(votosNulos[cat] || 0));
        formData.append('total_electores', String(totalElectores));
        formData.append('listas', JSON.stringify(catListasPayload));
        formData.append('foto_acta', catPhoto);
        formData.append('category', cat);

        await api.post('/diad/acta', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSubmittedCategories(prev => ({ ...prev, [cat]: true }));
        setSelectedCategory(null);
      } else {
        throw new Error('OFFLINE_FALLBACK');
      }
    } catch (err: any) {
      if (!navigator.onLine || err.message === 'OFFLINE_FALLBACK' || !err.response) {
        try {
          const reader = new FileReader();
          reader.readAsDataURL(catPhoto);
          reader.onloadend = async () => {
            const base64Data = reader.result;
            const { safePost } = await import('../services/syncService');
            await safePost('SUBMIT_ACTA', '/diad/acta', {
              mesa_id: tableInfo.mesa_id,
              votos_blanco: votosEnBlanco[cat] || 0,
              votos_nulos: votosNulos[cat] || 0,
              listas: JSON.stringify(catListasPayload),
              foto_acta_base64: base64Data,
              category: cat
            });
            setSubmittedCategories(prev => ({ ...prev, [cat]: true }));
            setSelectedCategory(null);
          };
        } catch (readErr) {
          setError('Error al procesar la imagen del acta en modo offline.');
        }
      } else {
        setError(err?.response?.data?.message || 'Error al enviar el acta. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueCategories = Array.from(new Set(listas.map(l => l.type || 'AUTORIDADES')));

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'INTENDENTE': return 'Intendente Municipal';
      case 'CONCEJAL': return 'Junta Municipal (Concejales)';
      case 'AUTORIDADES': return 'Autoridades Partidarias (Directorio/Comité)';
      default: return type.replace(/_/g, ' ');
    }
  };

  if (loading) return (
    <div style={{ padding: '1rem' }}>
      <Skeleton height={80} borderRadius={16} style={{ marginBottom: '1rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={60} borderRadius={16} />
        ))}
      </div>
    </div>
  );

  return (
    <div>
      {/* Mesa Header */}
      <div className="card-premium-styled" style={{ padding: '1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <MapPin size={24} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)' }}>{tableInfo.local || 'Sin asignación'}</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-3)', fontWeight: 800 }}>
            MESA <span style={{ color: 'var(--plra-200)', fontSize: '1.25rem', fontWeight: 900 }}>{tableInfo.mesa || '—'}</span>
          </p>
        </div>
      </div>

      {selectedCategory === null ? (
        <>
          {/* QR Scan trigger → ActaScanner */}
          <div className="card-premium-styled" style={{ padding: '1.5rem', marginBottom: '1.25rem', border: '1px solid var(--plra-400)', background: 'linear-gradient(135deg, rgba(0,71,171,0.12), rgba(0,71,171,0.04))' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <QrCode size={18} /> Escaneo de Actas QR (11 Cargos)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '1.1rem', lineHeight: 1.5 }}>
              Escanea los 11 QRs del acta oficial (uno por cargo) para registrar todos los resultados automáticamente.
            </p>
            <a
              href="/acta-scanner"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                width: '100%', padding: '1rem', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, var(--plra-500), var(--plra-600))',
                color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer',
                textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,71,171,0.35)'
              }}
            >
              <QrCode size={20} /> ABRIR ESCÁNER DE ACTAS
            </a>
          </div>

          {/* Grid of Categories */}
          <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', marginTop: '1.5rem' }}>
            Actas por Candidatura / Categorías ({uniqueCategories.length})
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {uniqueCategories.map(cat => {
              const isDone = submittedCategories[cat];
              const listsInCat = listas.filter(l => l.type === cat);
              const totalVotosCat = listsInCat.reduce((s, l) => s + l.votos, 0) + (votosEnBlanco[cat] || 0) + (votosNulos[cat] || 0);
              const hasPhoto = !!photoFiles[cat];

              return (
                <motion.div
                  key={cat}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedCategory(cat)}
                  className="card-premium-styled"
                  style={{
                    padding: '1.5rem',
                    cursor: 'pointer',
                    border: `1px solid ${isDone ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                    background: isDone ? 'rgba(34,197,94,0.03)' : 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    justifyContent: 'space-between',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', maxWidth: '80%' }}>
                      {getCategoryLabel(cat)}
                    </h4>
                    <span style={{
                      padding: '3px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900,
                      background: isDone ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
                      color: isDone ? '#22C47E' : '#EF4444',
                      border: `1px solid ${isDone ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                    }}>
                      {isDone ? 'COMPLETO' : 'PENDIENTE'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    <span>Votos: <strong>{totalVotosCat}</strong></span>
                    <span>Foto: <strong>{hasPhoto ? '✓ Cargada' : '✗ Faltante'}</strong></span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      ) : (
        /* Detailed View for Selected Category */
        <form onSubmit={(e) => handleCategorySubmit(e, selectedCategory)}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { setSelectedCategory(null); setError(''); }}
              style={{
                padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer'
              }}
            >
              ← Volver
            </button>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, alignSelf: 'center' }}>
              Carga de {getCategoryLabel(selectedCategory)}
            </h3>
          </div>

          {/* Votos list */}
          <div className="card-premium-styled" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>
              Votos por lista
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {listas.filter(l => l.type === selectedCategory).map(l => (
                <div key={l.lista_id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  padding: '1.1rem 1.25rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '18px',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>{l.nombre}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700 }}>LISTA {l.lista_id}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <motion.button
                      type="button" whileTap={{ scale: 0.85 }}
                      onClick={() => updateVotos(l.lista_id, -1)}
                      style={{
                        width: '46px', height: '46px', borderRadius: '14px',
                        border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.05)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Minus size={20} strokeWidth={3} />
                    </motion.button>
                    <input
                      type="number"
                      min={0}
                      value={l.votos}
                      onChange={e => setVotosDirecto(l.lista_id, e.target.value)}
                      style={{
                        width: '75px', textAlign: 'center',
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', color: 'white',
                        fontSize: '1.7rem', fontWeight: 900, padding: '0.5rem 0.25rem',
                        outline: 'none'
                      }}
                    />
                    <motion.button
                      type="button" whileTap={{ scale: 0.85 }}
                      onClick={() => updateVotos(l.lista_id, 1)}
                      style={{
                        width: '46px', height: '46px', borderRadius: '14px',
                        border: 'none',
                        background: 'var(--plra-500)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,71,171,0.3)'
                      }}
                    >
                      <Plus size={20} strokeWidth={3} />
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blancos y Nulos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Blancos', key: 'blancos', value: votosEnBlanco[selectedCategory] || 0, color: '#94A3B8', setter: (v: number) => setVotosEnBlanco(p => ({ ...p, [selectedCategory]: v })) },
              { label: 'Nulos', key: 'nulos', value: votosNulos[selectedCategory] || 0, color: '#EF4444', setter: (v: number) => setVotosNulos(p => ({ ...p, [selectedCategory]: v })) },
            ].map(({ label, value, color, setter }) => (
              <div key={label} className="card-premium-styled" style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.85rem' }}>{label}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                  <motion.button
                    type="button" whileTap={{ scale: 0.8 }}
                    onClick={() => setter(Math.max(0, value - 1))}
                    style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minus size={16} strokeWidth={3} />
                  </motion.button>
                  <span style={{ fontSize: '2.2rem', fontWeight: 900, color, minWidth: '45px' }}>{value}</span>
                  <motion.button
                    type="button" whileTap={{ scale: 0.8 }}
                    onClick={() => setter(value + 1)}
                    style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={16} strokeWidth={3} />
                  </motion.button>
                </div>
              </div>
            ))}
          </div>

          {/* Photo upload for this category */}
          <div className="card-premium-styled" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Camera size={18} /> Foto del Acta de esta Categoría (Física)
            </h3>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoSelect(e, selectedCategory)} style={{ display: 'none' }} />
            {photoPreviews[selectedCategory] ? (
              <div style={{ position: 'relative' }}>
                <img src={photoPreviews[selectedCategory] || undefined} alt="Vista previa" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '16px', border: '2px solid var(--green)' }} />
                <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => {
                  setPhotoFiles(p => ({ ...p, [selectedCategory]: null }));
                  setPhotoPreviews(p => ({ ...p, [selectedCategory]: null }));
                }}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '8px', color: 'white', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 800 }}>
                  CAMBIAR FOTO
                </motion.button>
              </div>
            ) : (
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()}
                style={{ width: '100%', padding: '3rem 1rem', border: '2px dashed var(--border)', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                <Upload size={40} style={{ color: 'var(--plra-300)' }} />
                <p style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>CAPTURAR ACTA</p>
              </motion.button>
            )}
          </div>

          {error && (
            <div style={{
              padding: '1.1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '14px', color: '#F87171', fontSize: '0.95rem', fontWeight: 700,
              marginBottom: '1.75rem', textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={submitting}
            whileTap={{ scale: 0.95 }}
            style={{
              width: '100%', padding: '1.4rem',
              borderRadius: '20px', border: 'none',
              background: submitting ? 'var(--text-3)' : 'linear-gradient(135deg, #22C47E 0%, #16a34a 100%)',
              color: 'white', fontWeight: 900, fontSize: '1.25rem',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem',
              boxShadow: '0 8px 30px rgba(22, 163, 74, 0.4)',
              marginBottom: '3.5rem'
            }}
          >
            {submitting ? 'Enviando...' : <><Send size={22} /> GUARDAR ACTA DE {selectedCategory}</>}
          </motion.button>
        </form>
      )}

      {/* QR SCANNER MODAL */}
      <AnimatePresence>
        {showQRScanner && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.95)', zIndex: 99999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '2rem'
          }}>
            <div style={{ width: '100%', maxWidth: '360px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>Escanear QR de Urna TSJE</span>
              <button 
                type="button" 
                onClick={() => setShowQRScanner(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Viewfinder / Camera stream */}
            <div style={{
              width: '100%', maxWidth: '400px', minHeight: '300px', border: '3px solid var(--plra-400)', borderRadius: '24px',
              position: 'relative', overflow: 'hidden', background: '#080d16',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
              boxShadow: '0 0 30px rgba(0,71,171,0.4)', padding: '10px'
            }}>
              <div id="veedor-qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }} />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────────────────────────
   APODERADO PANEL COMPONENT (MOBILE WORKBENCH)
   ───────────────────────────────────────────── */
const ApoderadoPanel = ({ user }: { user: any }) => {
  const [mesas, setMesas] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
  const [showSwapDrawer, setShowSwapDrawer] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleForAssign, setSelectedRoleForAssign] = useState<'PRESIDENTE' | 'VOCAL' | 'VEEDOR'>('PRESIDENTE');
  const [substitutingMemberId, setSubstitutingMemberId] = useState<number | null>(null);
  const [mesaConstitutions, setMesaConstitutions] = useState<Record<number, { is_confirmed: boolean, foto_acta_url: string | null }>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const covRes = await api.get('/diad/coverage');
      const memRes = await api.get('/diad/members');
      
      // Filter mesas belonging to the apoderado's school
      const schoolName = user?.assigned_local || '';
      const schoolMesas = covRes.data.mesas.filter((m: any) => m.local === schoolName);
      setMesas(schoolMesas);
      setMembers(memRes.data);

      const constitutionStatuses: Record<number, any> = {};
      for (const m of schoolMesas) {
        try {
          const statusRes = await api.get(`/diad/mesa/status/${encodeURIComponent(schoolName)}/${m.numero}`);
          constitutionStatuses[m.numero] = {
            is_confirmed: statusRes.data.is_confirmed,
            foto_acta_url: statusRes.data.foto_acta_url
          };
        } catch (e) {
          console.error(e);
        }
      }
      setMesaConstitutions(constitutionStatuses);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleAssign = async (memberId: number, memberRole: string) => {
    if (!selectedMesa) return;
    setActionLoading(true);
    try {
      if (substitutingMemberId) {
        // Liberate outgoing member first
        await api.post('/diad/members/assign', {
          user_id: substitutingMemberId,
          local: null,
          mesa: null
        });
      }

      await api.post('/diad/members/assign', {
        user_id: memberId,
        local: user.assigned_local,
        mesa: selectedMesa,
        role: memberRole,
        table_role: selectedRoleForAssign
      });
      setShowSwapDrawer(false);
      setSelectedMesa(null);
      setSubstitutingMemberId(null);
      await loadData();
    } catch (err) {
      alert('Error al asignar mesario.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmIntegrants = async (mesaNum: number) => {
    setActionLoading(true);
    try {
      await api.post('/diad/mesa/confirm', {
        local_votacion: user.assigned_local,
        mesa: mesaNum
      });
      alert('✅ Integrantes confirmados con éxito.');
      await loadData();
    } catch (err) {
      alert('Error al confirmar integrantes.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadActa = async (mesaNum: number, file: File) => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('local_votacion', user.assigned_local);
      formData.append('mesa', String(mesaNum));
      formData.append('photo', file);

      await api.post('/diad/mesa/upload-acta', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('✅ Fotografía del acta subida correctamente. Mesa constituida oficialmente.');
      await loadData();
    } catch (err) {
      alert('Error al subir la fotografía del acta.');
    } finally {
      setActionLoading(false);
    }
  };

  const [sosActive, setSosActive] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [liveSOSAlert, setLiveSOSAlert] = useState<any>(null);
  
  // Incident reporting states
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentMesa, setIncidentMesa] = useState<number | ''>('');
  const [incidentType, setIncidentType] = useState('Sustitución de Miembro');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentPhoto, setIncidentPhoto] = useState<File | null>(null);
  const [incidentPhotoPreview, setIncidentPhotoPreview] = useState<string | null>(null);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const incidentFileRef = useRef<HTMLInputElement>(null);

  // Monitor SSE for real-time SOS alerts and broadcast
  useSSE(useCallback((event) => {
    if (event.type === 'SOS_ALERT') {
      const alertData = event.data;
      setLiveSOSAlert(alertData);
      setSosActive(true);
      startSiren();
    }
  }, []));

  const handleIncidentPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIncidentPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setIncidentPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDescription.trim()) {
      alert('Por favor describa el incidente.');
      return;
    }
    
    setIncidentSubmitting(true);
    try {
      if (navigator.onLine) {
        const formData = new FormData();
        formData.append('local', user.assigned_local || 'General');
        formData.append('mesa', String(incidentMesa));
        formData.append('type', incidentType);
        formData.append('description', incidentDescription);
        if (incidentPhoto) {
          formData.append('photo', incidentPhoto);
        }
        await api.post('/diad/incidents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Offline queueing
        const base64Data = incidentPhotoPreview || null;
        const { safePost } = await import('../services/syncService');
        await safePost('INCIDENT_REPORT', '/diad/incidents', {
          local: user.assigned_local || 'General',
          mesa: incidentMesa,
          type: incidentType,
          description: incidentDescription,
          foto_base64: base64Data
        });
      }
      
      alert('✅ Incidencia/Sustitución reportada correctamente.');
      setShowIncidentModal(false);
      setIncidentMesa('');
      setIncidentDescription('');
      setIncidentPhoto(null);
      setIncidentPhotoPreview(null);
    } catch (err) {
      alert('Error al reportar la incidencia.');
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const handleLiberate = async (memberId: number, mesaNum: number) => {
    if (!window.confirm(`¿Liberar al mesario de la Mesa ${mesaNum}?`)) return;
    setActionLoading(true);
    try {
      await api.post('/diad/members/assign', {
        user_id: memberId,
        local: null,
        mesa: null
      });
      await loadData();
    } catch (err) {
      alert('Error al liberar mesario.');
    } finally {
      setActionLoading(false);
    }
  };

  const standbyPool = members.filter(m => !m.assigned_local || m.assigned_local === 'SIN ASIGNACIÓN' || m.assigned_local === '---');
  const filteredStandby = standbyPool.filter(m => !searchQuery || m.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || m.ci?.includes(searchQuery));

  // Monitor cross-tab / local storage sync events for SOS trigger
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'local_sos_siren') {
        if (e.newValue === 'ON') {
          setSosActive(true);
          startSiren();
        } else {
          setSosActive(false);
          stopSiren();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const triggerSOSAlert = async () => {
    if (sosActive) {
      setSosActive(false);
      localStorage.setItem('local_sos_siren', 'OFF');
      stopSiren();
      return;
    }

    setSosLoading(true);
    try {
      // Obtain GPS coordinates
      const coords = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
      }).catch(() => null);

      await api.post('/diad/sos', {
        message: `¡ALERTA ROJA SOS! Reportada por el Apoderado ${user?.nombre || ''} en el Local: ${user?.assigned_local || 'Desconocido'}.`,
        latitude: coords?.coords.latitude || null,
        longitude: coords?.coords.longitude || null,
        veedor_id: user?.id,
        type: 'error'
      });

      setSosActive(true);
      localStorage.setItem('local_sos_siren', 'ON');
      startSiren();
    } catch (e) {
      // In case of offline, emit locally anyway
      setSosActive(true);
      localStorage.setItem('local_sos_siren', 'ON');
      startSiren();
      
      const { safePost } = await import('../services/syncService');
      await safePost('SOS_ALERT', '/diad/sos', {
        message: `¡ALERTA ROJA SOS (OFFLINE)! Apoderado ${user?.nombre || ''} - Local: ${user?.assigned_local || 'Desconocido'}.`,
        veedor_id: user?.id
      });
    } finally {
      setSosLoading(false);
    }
  };

  const totalMesas = mesas.length;
  const constituidas = mesas.filter(m => {
    const assigned = members.find(mem => mem.assigned_local === user.assigned_local && mem.assigned_mesa === m.numero);
    return !!assigned;
  }).length;
  const vacantes = totalMesas - constituidas;

  return (
    <MainLayout title="Control de Local" userName={user?.nombre || 'Apoderado'}>
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', minHeight: 'calc(100vh - 70px)' }}>
        
        {/* SOS ALARM SECTION (Wow aesthetics) */}
        <div className="card-premium-styled" style={{
          padding: '1.25rem',
          marginBottom: '1rem',
          background: sosActive 
            ? 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(185,28,28,0.3) 100%)'
            : 'linear-gradient(135deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.6) 100%)',
          border: sosActive ? '2px solid rgba(239,68,68,0.8)' : '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {sosActive && (
            <motion.div 
              animate={{ opacity: [0.1, 0.4, 0.1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(239,68,68,0.4)', pointerEvents: 'none'
              }}
            />
          )}
          <AlertOctagon size={48} style={{ color: sosActive ? 'var(--red)' : 'rgba(239,68,68,0.7)', zIndex: 1 }} />
          <div style={{ zIndex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: '0 0 0.25rem' }}>
              {sosActive ? '¡ALARMA SOS EN REPRODUCCIÓN!' : 'BOTÓN DE ALERTA SOS'}
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>
              Use este botón ante disturbios, robos de actas, o incidentes graves en el local.
            </p>
          </div>
          <button
            onClick={triggerSOSAlert}
            disabled={sosLoading}
            style={{
              padding: '0.85rem 1.5rem',
              borderRadius: '12px',
              border: 'none',
              background: sosActive ? 'white' : 'var(--red)',
              color: sosActive ? 'var(--red)' : 'white',
              fontSize: '0.85rem',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
              zIndex: 1,
              width: '100%',
              letterSpacing: '0.05em'
            }}
          >
            {sosLoading ? 'Procesando...' : sosActive ? '🔴 DESACTIVAR ALERTA SIRENA' : '🚨 ACTIVAR ALERTA SOS'}
          </button>
        </div>

        {/* School Header */}
        <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <MapPin size={18} style={{ color: 'var(--plra-300)' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', margin: 0 }}>
              {user?.assigned_local || 'Sin Local Asignado'}
            </h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
            Panel móvil de Apoderado de Local · PLRA Internas 2026
          </p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{totalMesas}</span>
              <span style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Mesas</span>
            </div>
            <div style={{ flex: 1, padding: '0.6rem', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 900, color: 'var(--green)' }}>{constituidas}</span>
              <span style={{ fontSize: '0.55rem', color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase' }}>OK</span>
            </div>
            <div style={{ flex: 1, padding: '0.6rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 900, color: 'var(--red)' }}>{vacantes}</span>
              <span style={{ fontSize: '0.55rem', color: 'var(--red)', fontWeight: 800, textTransform: 'uppercase' }}>Vacantes</span>
            </div>
          </div>
          <button
            onClick={() => setShowIncidentModal(true)}
            style={{
              marginTop: '1rem', width: '100%', padding: '0.75rem', borderRadius: '12px',
              border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)',
              color: '#F59E0B', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}
          >
            <AlertTriangle size={16} /> REPORTAR INCIDENCIA / SUSTITUCIÓN
          </button>
        </div>

        {/* Mesas List */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', padding: '0 0.25rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Mesas de Votación
          </h3>
          <button 
            onClick={loadData}
            style={{ background: 'transparent', border: 'none', color: 'var(--plra-300)', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>Cargando mesas...</p>
          </div>
        ) : mesas.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
            <p>No se encontraron mesas configuradas para este local.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '3rem' }}>
            {mesas.map(mesa => {
              const mesaMembers = members.filter(mem => mem.assigned_local === user.assigned_local && mem.assigned_mesa === mesa.numero);
              const constitution = mesaConstitutions[mesa.numero];
              const isConfirmed = constitution?.is_confirmed || false;
              const fotoActaUrl = constitution?.foto_acta_url || null;

              const roles = [
                { key: 'PRESIDENTE', label: 'Presidente' },
                { key: 'VOCAL', label: 'Vocal' },
                { key: 'VEEDOR', label: 'Veedor' }
              ] as const;

              return (
                <div 
                  key={mesa.numero}
                  className="card-premium-styled"
                  style={{
                    padding: '1rem',
                    border: fotoActaUrl 
                      ? '1px solid rgba(37,200,130,0.15)' 
                      : isConfirmed 
                        ? '1px solid rgba(59,130,246,0.2)' 
                        : '1px solid rgba(239,68,68,0.2)',
                    background: 'rgba(255,255,255,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.8rem'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'white' }}>
                      MESA {mesa.numero}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.55rem', fontWeight: 900,
                      background: fotoActaUrl 
                        ? 'rgba(37,200,130,0.1)' 
                        : isConfirmed 
                          ? 'rgba(59,130,246,0.1)' 
                          : 'rgba(239,68,68,0.1)',
                      color: fotoActaUrl 
                        ? 'var(--green)' 
                        : isConfirmed 
                          ? '#3B82F6' 
                          : 'var(--red)',
                      border: `1px solid ${
                        fotoActaUrl 
                          ? 'rgba(37,200,130,0.2)' 
                          : isConfirmed 
                            ? 'rgba(59,130,246,0.2)' 
                            : 'rgba(239,68,68,0.2)'
                      }`
                    }}>
                      {fotoActaUrl 
                        ? 'CONSTITUIDA OFICIALMENTE' 
                        : isConfirmed 
                          ? 'INTEGRANTES CONFIRMADOS' 
                          : 'PENDIENTE DE CONFIRMACIÓN'}
                    </span>
                  </div>

                  {/* Roles List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {roles.map(role => {
                      const member = mesaMembers.find(m => m.assigned_table_role === role.key);

                      return (
                        <div 
                          key={role.key} 
                          style={{ 
                            padding: '0.6rem', 
                            background: 'rgba(255,255,255,0.01)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.3rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                              {role.label}
                            </span>
                            {member ? (
                              <span style={{ fontSize: '0.55rem', color: '#10B981', fontWeight: 800 }}>
                                ✓ Asignado
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.55rem', color: '#EF4444', fontWeight: 800 }}>
                                Sin Asignar
                              </span>
                            )}
                          </div>

                          {member ? (
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                                {member.nombre}
                              </div>
                              <div style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>
                                CI: {member.ci || '—'}
                              </div>

                              {/* Call/WhatsApp Actions */}
                              {member.telefono && (
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                                  <a 
                                    href={`tel:${member.telefono}`}
                                    style={{
                                      padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)',
                                      background: 'rgba(255,255,255,0.03)', color: 'var(--text-2)', fontSize: '0.58rem',
                                      fontWeight: 700, textDecoration: 'none'
                                    }}
                                  >
                                    📞 Llamar
                                  </a>
                                  <a 
                                    href={`https://wa.me/595${member.telefono.replace(/\s+/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(34,197,94,0.2)',
                                      background: 'rgba(34,197,94,0.05)', color: '#4ADE80', fontSize: '0.58rem',
                                      fontWeight: 700, textDecoration: 'none'
                                    }}
                                  >
                                    💬 WhatsApp
                                  </a>
                                </div>
                              )}

                              {/* Member Specific Assignment Actions */}
                              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                                <button
                                  onClick={() => { 
                                    setSelectedMesa(mesa.numero); 
                                    setSelectedRoleForAssign(role.key); 
                                    setSubstitutingMemberId(member.id); 
                                    setShowSwapDrawer(true); 
                                  }}
                                  style={{
                                    flex: 1, padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)',
                                    background: 'rgba(255,255,255,0.02)', color: 'var(--text-2)', fontSize: '0.6rem',
                                    fontWeight: 800, cursor: 'pointer'
                                  }}
                                >
                                  SUSTITUIR
                                </button>
                                <button
                                  onClick={() => handleLiberate(member.id, mesa.numero)}
                                  style={{
                                    padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.15)',
                                    background: 'rgba(239,68,68,0.05)', color: 'var(--red)', fontSize: '0.6rem',
                                    fontWeight: 800, cursor: 'pointer'
                                  }}
                                >
                                  LIBERAR
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { 
                                setSelectedMesa(mesa.numero); 
                                setSelectedRoleForAssign(role.key); 
                                setSubstitutingMemberId(null); 
                                setShowSwapDrawer(true); 
                              }}
                              style={{
                                width: '100%', padding: '0.4rem', borderRadius: '6px', border: 'none',
                                background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white',
                                fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer'
                              }}
                            >
                              + ASIGNAR {role.key}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mesa Constitution Actions */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {!isConfirmed ? (
                      <button
                        onClick={() => handleConfirmIntegrants(mesa.numero)}
                        disabled={actionLoading}
                        style={{
                          width: '100%', padding: '0.65rem', borderRadius: '8px', border: 'none',
                          background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white',
                          fontSize: '0.72rem', fontWeight: 900, cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                        }}
                      >
                        ✓ CONFIRMAR INTEGRANTES
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981', fontSize: '0.7rem', fontWeight: 800 }}>
                        <span>✓ INTEGRANTES CONFIRMADOS EN SERVIDOR</span>
                      </div>
                    )}

                    <div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        id={`acta-upload-${mesa.numero}`}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadActa(mesa.numero, file);
                        }}
                      />
                      
                      <button
                        onClick={() => document.getElementById(`acta-upload-${mesa.numero}`)?.click()}
                        disabled={!isConfirmed || actionLoading}
                        style={{
                          width: '100%', 
                          padding: '0.65rem', 
                          borderRadius: '8px', 
                          border: isConfirmed ? '1px dashed #10B981' : '1px solid var(--border)',
                          background: isConfirmed ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.01)',
                          color: isConfirmed ? '#10B981' : 'var(--text-3)',
                          fontSize: '0.72rem', 
                          fontWeight: 900, 
                          cursor: isConfirmed ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <Camera size={14} /> FOTOGRAFÍA ACTA DE CONSTITUCIÓN
                      </button>
                    </div>

                    {fotoActaUrl && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <a 
                          href={getImageUrl(fotoActaUrl) || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.65rem',
                            color: 'var(--plra-300)',
                            fontWeight: 800,
                            textDecoration: 'none'
                          }}
                        >
                          <FileText size={14} /> Ver Acta de Constitución subida
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Drawer: Standby Substitutes Pool (Gamified Mobile Overlay) */}
        <AnimatePresence>
          {showSwapDrawer && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              zIndex: 9999, display: 'flex', alignItems: 'flex-end'
            }}>
              {/* Back close click mask */}
              <div 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '60%', cursor: 'pointer' }}
                onClick={() => { setShowSwapDrawer(false); setSelectedMesa(null); }}
              />

              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                style={{
                  width: '100%', height: '70%',
                  background: 'var(--surface-light)',
                  borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                  borderTop: '1px solid var(--border)',
                  padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
                }}
              >
                {/* Drawer Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: 'white', margin: 0 }}>
                      {substitutingMemberId 
                        ? `Sustituir ${selectedRoleForAssign} · Mesa ${selectedMesa}` 
                        : `Asignar ${selectedRoleForAssign} · Mesa ${selectedMesa}`}
                    </h4>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>
                      {substitutingMemberId 
                        ? 'Seleccione el reemplazante de la reserva que asumirá este cargo.' 
                        : 'Seleccione personal libre del banco de reserva del local.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setShowSwapDrawer(false); setSelectedMesa(null); setSubstitutingMemberId(null); }}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
                      border: 'none', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Drawer Search */}
                <div className="search-input-wrapper-premium" style={{ width: '100%' }}>
                  <input 
                    className="modern-input-premium-styled" 
                    placeholder="Buscar por nombre o CI..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  />
                </div>

                {/* Substitutes List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingBottom: '1rem' }}>
                  {actionLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="loading-spinner" style={{ margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem', color: 'var(--text-3)', fontSize: '0.75rem' }}>Efectuando swap...</p>
                    </div>
                  ) : filteredStandby.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center', padding: '2rem' }}>
                      No hay suplentes disponibles en reserva.
                    </p>
                  ) : (
                    filteredStandby.map(m => (
                      <div 
                        key={m.id}
                        onClick={() => handleAssign(m.id, m.role)}
                        style={{
                          padding: '0.85rem', background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border)', borderRadius: '12px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', display: 'block' }}>{m.nombre}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>CI: {m.ci || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ 
                            padding: '1px 5px', borderRadius: '4px', fontSize: '0.5rem', fontWeight: 800,
                            background: m.role === 'VEEDOR' ? 'rgba(168,85,247,0.1)' : 'rgba(37,200,130,0.1)',
                            color: m.role === 'VEEDOR' ? '#A855F7' : '#25C882',
                            border: `1px solid ${m.role === 'VEEDOR' ? 'rgba(168,85,247,0.2)' : 'rgba(37,200,130,0.2)'}`
                          }}>
                            {m.role}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontWeight: 900 }}>
                            {substitutingMemberId ? '➔ Sustituir' : '➔ Asignar'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* INCIDENT REPORT MODAL */}
        <AnimatePresence>
          {showIncidentModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
            }}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                  width: '100%', maxWidth: '400px',
                  background: 'var(--surface-light)', borderRadius: '24px',
                  padding: '1.75rem', border: '1px solid var(--border)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', gap: '1.2rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>
                    Reportar Incidencia o Sustitución
                  </h4>
                  <button 
                    onClick={() => setShowIncidentModal(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleIncidentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Mesa Afectada
                    </label>
                    <select
                      value={incidentMesa}
                      onChange={e => setIncidentMesa(e.target.value ? Number(e.target.value) : '')}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}
                    >
                      <option value="">-- Mesa General / Todas --</option>
                      {mesas.map(m => (
                        <option key={m.numero} value={m.numero} style={{ background: '#0e1726' }}>Mesa {m.numero}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Tipo de Incidencia
                    </label>
                    <select
                      value={incidentType}
                      onChange={e => setIncidentType(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}
                    >
                      <option value="Sustitución de Miembro" style={{ background: '#0e1726' }}>Sustitución de Miembro</option>
                      <option value="Falta de Materiales / Copiatines" style={{ background: '#0e1726' }}>Falta de Materiales / Copiatines</option>
                      <option value="Impugnación de Voto" style={{ background: '#0e1726' }}>Impugnación de Voto</option>
                      <option value="Disturbios / Intento de Fraude" style={{ background: '#0e1726' }}>Disturbios / Intento de Fraude</option>
                      <option value="Otros" style={{ background: '#0e1726' }}>Otros incidentes</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Descripción / Detalles
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describa brevemente qué ocurrió y qué medidas se tomaron..."
                      value={incidentDescription}
                      onChange={e => setIncidentDescription(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', outline: 'none', resize: 'none', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Foto del Acta de Incidencia o Comprobante
                    </label>
                    <input 
                      ref={incidentFileRef} 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleIncidentPhotoSelect} 
                      style={{ display: 'none' }} 
                    />
                    
                    {incidentPhotoPreview ? (
                      <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                        <img src={incidentPhotoPreview} alt="Vista previa" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--plra-400)' }} />
                        <button 
                          type="button" 
                          onClick={() => { setIncidentPhoto(null); setIncidentPhotoPreview(null); }}
                          style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '4px', color: 'white', padding: '4px 8px', fontSize: '0.6rem', fontWeight: 800 }}
                        >
                          QUITAR
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => incidentFileRef.current?.click()}
                        style={{
                          width: '100%', padding: '1rem', border: '1px dashed var(--border)', borderRadius: '12px',
                          background: 'rgba(255,255,255,0.01)', color: 'var(--text-2)', fontSize: '0.75rem', fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
                        }}
                      >
                        <Camera size={16} /> TOMAR FOTO DEL ACTA
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={incidentSubmitting}
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '14px', border: 'none',
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white',
                      fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem',
                      boxShadow: '0 4px 15px rgba(245,158,11,0.2)'
                    }}
                  >
                    {incidentSubmitting ? 'Enviando Reporte...' : '✓ REGISTRAR INCIDENCIA'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* LIVE SOS ALERT OVERLAY */}
        <AnimatePresence>
          {liveSOSAlert && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(220,38,38,0.4)', backdropFilter: 'blur(10px)',
              zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
            }}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                style={{
                  width: '100%', maxWidth: '340px',
                  background: '#0B0202', borderRadius: '24px',
                  padding: '2rem', border: '3px solid #EF4444',
                  boxShadow: '0 0 50px rgba(239,68,68,0.7)',
                  textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    style={{
                      width: '72px', height: '72px', borderRadius: '50%',
                      background: 'rgba(239,68,68,0.1)', border: '2px solid #EF4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <AlertOctagon size={40} color="#EF4444" />
                  </motion.div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', margin: '0 0 0.5rem' }}>
                    🚨 ALERTA ROJA RECIBIDA
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#FCA5A5', margin: 0, lineHeight: 1.4 }}>
                    {liveSOSAlert.body}
                  </p>
                  {liveSOSAlert.latitude && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
                      Ubicación: {liveSOSAlert.latitude.toFixed(5)}, {liveSOSAlert.longitude.toFixed(5)}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {liveSOSAlert.latitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${liveSOSAlert.latitude},${liveSOSAlert.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.85rem', borderRadius: '12px', background: 'white', color: '#EF4444',
                        fontWeight: 900, fontSize: '0.8rem', textDecoration: 'none', display: 'block'
                      }}
                    >
                      🗺️ VER EN GOOGLE MAPS
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setLiveSOSAlert(null);
                      setSosActive(false);
                      stopSiren();
                    }}
                    style={{
                      padding: '0.85rem', borderRadius: '12px', background: '#EF4444', color: 'white',
                      fontWeight: 900, fontSize: '0.8rem', border: 'none', cursor: 'pointer'
                    }}
                  >
                    🔕 SILENCIAR ALERTA
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

export default VeedorApp;

