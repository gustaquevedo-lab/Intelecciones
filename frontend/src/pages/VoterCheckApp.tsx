import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Trash2, Users, MapPin, AlertTriangle, Hash, RefreshCw } from 'lucide-react';
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
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/voter-check/history');
      setHistory(res.data);
    } catch { /* ignore */ } finally {
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
    } catch { /* ignore */ }
  };

  const formatTime = (dt: string) => {
    try {
      const d = new Date(dt.includes('Z') ? dt : dt + 'Z');
      return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return dt; }
  };

  return (
    <MainLayout
      title="Verificación de Electores"
      userName={user?.nombre || ''}
      userPhoto={getImageUrl(user?.photo_url) || ''}
    >
      <div style={{ padding: '1rem', maxWidth: '680px', margin: '0 auto' }}>

        {/* ─── CI Input ─── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '1rem'
        }}>
          <p style={{
            fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}>
            <Hash size={13} style={{ color: 'var(--plra-300)' }} />
            Cédula de Identidad
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              value={ci}
              onChange={e => { setCi(e.target.value); setError(''); setElector(null); setSuccessMsg(''); }}
              placeholder="Ej: 4567890"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '0.9rem 1rem',
                borderRadius: '12px',
                border: '2px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text)',
                fontSize: '1.3rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                outline: 'none',
                WebkitAppearance: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={loading || !ci.trim()}
              style={{
                width: '100%',
                padding: '0.9rem',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--plra-500)',
                color: 'white',
                fontWeight: 900,
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: loading || !ci.trim() ? 0.6 : 1,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
            Con o sin puntos. Presioná Enter o el botón.
          </p>
        </div>

        {/* ─── Feedback ─── */}
        <AnimatePresence mode="wait">
          {successMsg && (
            <motion.div key="ok"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                background: 'rgba(37,200,130,0.1)', border: '1px solid rgba(37,200,130,0.3)',
                borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem'
              }}
            >
              <CheckCircle2 size={22} />
              {successMsg}
            </motion.div>
          )}

          {error && (
            <motion.div key="err"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                color: 'var(--red)', fontWeight: 700, fontSize: '0.85rem'
              }}
            >
              <XCircle size={20} />
              {error}
            </motion.div>
          )}

          {elector && (
            <motion.div key="elector"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{
                background: elector.already_confirmed ? 'rgba(245,158,11,0.06)' : 'rgba(21,88,176,0.07)',
                border: `2px solid ${elector.already_confirmed ? 'rgba(245,158,11,0.3)' : 'rgba(21,88,176,0.25)'}`,
                borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem',
              }}
            >
              {elector.already_confirmed && (
                <div style={{
                  background: 'rgba(245,158,11,0.12)', borderRadius: '10px', padding: '0.75rem 1rem',
                  marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
                  border: '1px solid rgba(245,158,11,0.35)',
                }}>
                  <AlertTriangle size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#F59E0B', margin: 0 }}>
                      Este elector ya fue confirmado
                    </p>
                    {elector.confirmed_at && (
                      <p style={{ fontSize: '0.65rem', color: 'rgba(245,158,11,0.8)', margin: '2px 0 0' }}>
                        Registrado a las {formatTime(elector.confirmed_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Nombre grande */}
              <p style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.2, marginBottom: '0.2rem' }}>
                {elector.nombre} {elector.apellido}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                CI: {elector.ci}
              </p>

              {/* Info en grid 2 cols */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.3rem' }}>
                    <MapPin size={10} style={{ display: 'inline', marginRight: '3px' }} />Local
                  </p>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                    {elector.local_votacion}
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.3rem' }}>
                    Mesa / Orden
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--plra-300)' }}>
                    Mesa {elector.mesa} — #{elector.orden}
                  </p>
                </div>
              </div>

              {/* Confirm button — solo si NO está ya confirmado */}
              {!elector.already_confirmed && (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #1558B0, #0D3D7A)',
                    color: 'white',
                    fontWeight: 900,
                    fontSize: '1rem',
                    cursor: confirming ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                    opacity: confirming ? 0.7 : 1,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <CheckCircle2 size={20} />
                  {confirming ? 'Confirmando...' : 'Confirmar Presencia'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── History toggle button ─── */}
        <button
          onClick={() => setShowHistory(p => !p)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: showHistory ? '0.5rem' : 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} style={{ color: 'var(--plra-300)' }} />
            Historial de Confirmaciones
            <span style={{
              background: 'rgba(21,88,176,0.2)', color: 'var(--plra-300)',
              padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800
            }}>
              {history.length}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={(e) => { e.stopPropagation(); loadHistory(); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '2px', display: 'flex' }}
              title="Actualizar"
            >
              <RefreshCw size={14} />
            </button>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{showHistory ? '▲' : '▼'}</span>
          </span>
        </button>

        {/* ─── History list ─── */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              key="history"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', overflow: 'hidden', marginTop: '0.25rem'
              }}>
                {historyLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                    Cargando...
                  </div>
                ) : history.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
                    <CheckCircle2 size={32} style={{ opacity: 0.15, marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.8rem', fontWeight: 700 }}>Sin confirmaciones aún</p>
                  </div>
                ) : (
                  history.map((h, idx) => (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderBottom: idx < history.length - 1 ? '1px solid var(--border)' : 'none',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.nombre} {h.apellido}
                        </p>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          CI: {h.elector_ci} · M{h.mesa}/#{h.orden}
                        </p>
                        <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.local_votacion}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--plra-300)', whiteSpace: 'nowrap' }}>
                          {formatTime(h.confirmed_at)}
                        </span>
                        <button
                          onClick={() => handleDelete(h.elector_ci)}
                          title="Deshacer"
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-3)', padding: '4px', display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </MainLayout>
  );
}
