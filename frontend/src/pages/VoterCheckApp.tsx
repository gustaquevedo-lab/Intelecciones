import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, XCircle, Clock, Trash2, Users, MapPin, AlertTriangle, Hash } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api, { getImageUrl } from '../services/api';

interface ElectorResult {
  ci: string;
  nombre: string;
  apellido: string;
  local_votacion: string;
  mesa: number;
  orden: number;
  distrito: string;
  already_confirmed: boolean;
  confirmed_at: string | null;
}

interface ConfirmationRecord {
  id: number;
  elector_ci: string;
  nombre: string;
  apellido: string;
  local_votacion: string;
  mesa: number;
  orden: number;
  distrito: string;
  confirmed_at: string;
  coordinator_nombre: string;
}

export default function VoterCheckApp() {
  const { user } = useAuth();
  const [ci, setCi] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [elector, setElector] = useState<ElectorResult | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [history, setHistory] = useState<ConfirmationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/voter-check/history');
      setHistory(res.data);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = ci.replace(/\./g, '').replace(/ /g, '').trim();
    if (!cleaned) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setElector(null);

    try {
      const res = await api.get(`/voter-check/elector/${cleaned}`);
      setElector(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Elector no encontrado en el padrón');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!elector) return;
    setConfirming(true);
    setError('');
    try {
      await api.post('/voter-check/confirm', { ci: elector.ci });
      setSuccessMsg(`✔ ${elector.nombre} ${elector.apellido} confirmado`);
      setElector(null);
      setCi('');
      await loadHistory();
      setTimeout(() => {
        setSuccessMsg('');
        inputRef.current?.focus();
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al confirmar');
    } finally {
      setConfirming(false);
    }
  };

  const handleDelete = async (ci: string) => {
    try {
      await api.delete(`/voter-check/${ci}`);
      setHistory(prev => prev.filter(h => h.elector_ci !== ci));
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const formatTime = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <MainLayout
      title="Verificación de Electores"
      userName={user?.nombre || ''}
      userPhoto={getImageUrl(user?.photo_url) || ''}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '420px 1fr',
        gap: '1.5rem',
        padding: '1.25rem',
        height: 'calc(100vh - 102px)',
        overflow: 'hidden'
      }}>

        {/* ─── Left panel: CI scanner ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>

          {/* CI input card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.5rem',
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hash size={16} style={{ color: 'var(--plra-300)' }} />
              Ingresá la Cédula de Identidad
            </h2>

            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={ci}
                onChange={e => { setCi(e.target.value); setError(''); setElector(null); setSuccessMsg(''); }}
                onKeyDown={handleKeyDown}
                placeholder="Ej: 4567890"
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '2px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text)',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={loading || !ci.trim()}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--plra-500)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  opacity: loading || !ci.trim() ? 0.6 : 1,
                }}
              >
                <Search size={16} />
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
              Presioná Enter o el botón Buscar. La cédula puede tener puntos o no.
            </p>
          </div>

          {/* Result / error / success */}
          <AnimatePresence mode="wait">
            {successMsg && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  background: 'rgba(37,200,130,0.1)',
                  border: '1px solid rgba(37,200,130,0.3)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--green)',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}
              >
                <CheckCircle2 size={22} />
                {successMsg}
              </motion.div>
            )}

            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--red)',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}
              >
                <XCircle size={22} />
                {error}
              </motion.div>
            )}

            {elector && (
              <motion.div
                key="elector"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  background: elector.already_confirmed
                    ? 'rgba(245,158,11,0.08)'
                    : 'rgba(21,88,176,0.08)',
                  border: `1px solid ${elector.already_confirmed ? 'rgba(245,158,11,0.3)' : 'rgba(21,88,176,0.25)'}`,
                  borderRadius: '16px',
                  padding: '1.5rem',
                }}
              >
                {elector.already_confirmed && (
                  <div style={{
                    background: 'rgba(245,158,11,0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: '#F59E0B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    <AlertTriangle size={14} />
                    Ya fue confirmado el {elector.confirmed_at ? formatTime(elector.confirmed_at) : ''}
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.2, marginBottom: '0.25rem' }}>
                    {elector.nombre} {elector.apellido}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700 }}>
                    CI: {elector.ci}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                      <MapPin size={10} style={{ display: 'inline', marginRight: '3px' }} />Local
                    </p>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{elector.local_votacion}</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                      Mesa / Orden
                    </p>
                    <p style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--plra-300)' }}>
                      Mesa {elector.mesa} — #{elector.orden}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: elector.already_confirmed
                      ? 'rgba(245,158,11,0.2)'
                      : 'linear-gradient(135deg, #1558B0, #0D3D7A)',
                    color: elector.already_confirmed ? '#F59E0B' : 'white',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    cursor: confirming ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: confirming ? 0.7 : 1,
                    transition: 'all 0.15s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <CheckCircle2 size={18} />
                  {confirming ? 'Confirmando...' : elector.already_confirmed ? 'Confirmar de Nuevo' : 'Confirmar Presencia'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Right panel: History ─── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} style={{ color: 'var(--plra-300)' }} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text)' }}>
                Historial de Confirmaciones
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{
                background: 'rgba(21,88,176,0.15)',
                color: 'var(--plra-300)',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 800
              }}>
                <Users size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {history.length} confirmados
              </span>
              <button
                onClick={loadHistory}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Actualizar
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                Cargando historial...
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                <CheckCircle2 size={40} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>Sin confirmaciones aún</p>
                <p style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Los electores confirmados aparecerán aquí</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {history.map((h, idx) => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx < 10 ? idx * 0.03 : 0 }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0.75rem',
                      background: 'rgba(255,255,255,0.025)',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>
                        {h.nombre} {h.apellido}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600, marginLeft: '0.5rem' }}>
                          CI: {h.elector_ci}
                        </span>
                      </p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
                        {h.local_votacion} — Mesa {h.mesa} / #{h.orden}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--plra-300)', whiteSpace: 'nowrap' }}>
                      {formatTime(h.confirmed_at)}
                    </span>
                    <button
                      onClick={() => handleDelete(h.elector_ci)}
                      title="Deshacer confirmación"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-3)',
                        padding: '4px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
