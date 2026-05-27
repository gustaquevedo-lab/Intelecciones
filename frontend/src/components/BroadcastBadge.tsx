import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, CheckCircle2, XCircle, Pause, Play, X, ChevronRight } from 'lucide-react';
import { useBroadcast } from '../context/BroadcastContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BroadcastBadge: React.FC = () => {
  const { broadcast, pause, resume, cancel } = useBroadcast();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Only show for authorized roles
  const role = user?.role;
  const canSee = role === 'SUPERUSUARIO' || role === 'JEFE_CAMPANA' || role === 'SUBJEFE';
  if (!canSee || !broadcast) return null;

  const { status, sent, failed, total, logId } = broadcast;
  const isActive = status === 'RUNNING' || status === 'PAUSED';
  const isDone = status === 'COMPLETED' || status === 'CANCELLED';

  // Dismiss completed/cancelled badge after user sees it
  if (dismissed && isDone) return null;

  const pct = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

  const goToOutbox = () => {
    navigate('/comunicaciones');
    setExpanded(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="broadcast-badge"
        initial={{ opacity: 0, y: 80, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          minWidth: expanded ? '320px' : 'auto',
          maxWidth: '380px',
          background: 'var(--surface)',
          border: `1px solid ${isActive ? 'rgba(139,92,246,0.5)' : isDone && status === 'CANCELLED' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        {/* Header row — always visible */}
        <div
          onClick={() => setExpanded(e => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.65rem 0.9rem',
            background: isActive
              ? 'rgba(139,92,246,0.08)'
              : isDone && status === 'CANCELLED'
              ? 'rgba(239,68,68,0.08)'
              : 'rgba(34,197,94,0.08)',
          }}
        >
          {/* Icon */}
          {isActive ? (
            <Radio
              size={16}
              className={status === 'RUNNING' ? 'animate-pulse' : ''}
              style={{ color: status === 'PAUSED' ? 'var(--text-3)' : 'var(--plra-300)', flexShrink: 0 }}
            />
          ) : status === 'CANCELLED' ? (
            <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
          )}

          {/* Label */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isActive
                ? status === 'PAUSED' ? '⏸ Difusión pausada' : '📡 Difusión en curso'
                : status === 'CANCELLED' ? '✗ Difusión cancelada' : '✓ Difusión completada'}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '1px' }}>
              {sent} env · {failed} fall · {total} total {isActive ? `· ${pct}%` : ''}
            </div>
          </div>

          {/* Progress ring / chevron */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
            {isActive && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: `conic-gradient(var(--plra-400) ${pct * 3.6}deg, var(--surface-light) 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.45rem', fontWeight: 900, color: 'var(--text)' }}>{pct}%</span>
                </div>
              </div>
            )}
            <ChevronRight
              size={13}
              style={{ color: 'var(--text-3)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
            />
          </div>
        </div>

        {/* Progress bar */}
        {isActive && (
          <div style={{ height: '3px', background: 'var(--surface-light)' }}>
            <motion.div
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
              style={{ height: '100%', background: status === 'PAUSED' ? 'var(--text-3)' : 'linear-gradient(90deg, var(--plra-500), var(--plra-300))' }}
            />
          </div>
        )}

        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {status === 'RUNNING' && logId > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); pause(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Pause size={11} /> Pausar
                    </button>
                  )}
                  {status === 'PAUSED' && logId > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); resume(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', borderRadius: '8px', border: 'none', background: 'var(--plra-500)', color: 'white', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Play size={11} /> Reanudar
                    </button>
                  )}
                  {isActive && logId > 0 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm('¿Cancelar la difusión masiva en curso?')) cancel();
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <X size={11} /> Cancelar
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); goToOutbox(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--plra-300)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Ver Bandeja →
                  </button>
                  {isDone && (
                    <button
                      onClick={e => { e.stopPropagation(); setDismissed(true); }}
                      style={{ padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', fontSize: '0.68rem', cursor: 'pointer' }}
                    >
                      Cerrar
                    </button>
                  )}
                </div>

                {/* Stats summary */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ {sent} enviados</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>✗ {failed} fallidos</span>
                  <span style={{ color: 'var(--text-3)' }}>de {total} total</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default BroadcastBadge;
