import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  QrCode, CheckCircle, ChevronRight, AlertTriangle, RefreshCw,
  MapPin, FileText, RotateCcw, Check, X, Loader, ChevronLeft,
  Wifi, WifiOff
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Lista {
  id: number;
  list_number: string | number;
  nombre: string;
  color: string;
}

interface ParsedActa {
  cargo: string;
  cargo_byte?: number;
  mesaId: string | null;
  blancos: number;
  nulos: number;
  total: number;
  votos: Record<string, number>; // list_number → votes
  autoDecoded: boolean;
}

interface ActaEntry {
  cargoKey: string;
  label: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'error';
  parsed?: ParsedActa;
  error?: string;
}

// ─── CARGO DEFINITIONS ───────────────────────────────────────────────────────

// Maps cargo byte → { label, category for DB, expectedLists }
const CARGO_DEFINITIONS: Record<string, { label: string; category: string; cargoByte?: number; autoDecodable: boolean }> = {
  INTENDENTE:                    { label: 'Intendente Municipal',              category: 'INTENDENTE',         cargoByte: 0xA7, autoDecodable: true },
  JUNTA_MUNICIPAL:               { label: 'Junta Municipal',                   category: 'CONCEJAL',           cargoByte: 0x2B, autoDecodable: false },
  PRESIDENTE_VICE_PLRA:          { label: 'Presidente / Vice PLRA',            category: 'AUTORIDADES',        cargoByte: 0xA6, autoDecodable: false },
  DIRECTORIO_NACIONAL:           { label: 'Directorio Nacional',               category: 'AUTORIDADES',        cargoByte: 0x1E, autoDecodable: false },
  DIRECTORIO_DEPARTAMENTAL:      { label: 'Directorio Departamental',          category: 'AUTORIDADES',        cargoByte: 0x81, autoDecodable: true },
  COMITE_LOCAL:                  { label: 'Comité Local',                      category: 'AUTORIDADES',        cargoByte: 0x83, autoDecodable: false },
  CONVENCIONAL:                  { label: 'Convencional',                      category: 'AUTORIDADES',        cargoByte: 0x64, autoDecodable: false },
  PRESIDENTE_VICE_JLRA:          { label: 'Presidente / Vice JLRA',            category: 'AUTORIDADES_JLRA',  cargoByte: 0x04, autoDecodable: false },
  CONDUCCION_NACIONAL_JLRA:      { label: 'Conducción Nacional JLRA',         category: 'AUTORIDADES_JLRA',  cargoByte: 0x94, autoDecodable: false },
  REPRESENTANTE_DEPARTAMENTAL_JLRA: { label: 'Representante Departamental JLRA', category: 'AUTORIDADES_JLRA', cargoByte: 0x2A, autoDecodable: false },
  MIEMBRO_FILIAL_JLRA:           { label: 'Miembro Filial JLRA',              category: 'AUTORIDADES_JLRA',  cargoByte: 0xEE, autoDecodable: false },
};

const CARGO_ORDER = [
  'INTENDENTE', 'JUNTA_MUNICIPAL', 'PRESIDENTE_VICE_PLRA',
  'DIRECTORIO_NACIONAL', 'DIRECTORIO_DEPARTAMENTAL', 'COMITE_LOCAL',
  'CONVENCIONAL', 'PRESIDENTE_VICE_JLRA', 'CONDUCCION_NACIONAL_JLRA',
  'REPRESENTANTE_DEPARTAMENTAL_JLRA', 'MIEMBRO_FILIAL_JLRA',
];

// Reverse lookup: cargoByte → cargoKey
const BYTE_TO_CARGO: Record<number, string> = {};
Object.entries(CARGO_DEFINITIONS).forEach(([key, val]) => {
  if (val.cargoByte !== undefined) BYTE_TO_CARGO[val.cargoByte] = key;
});

// ─── HELPER: QR DECODE ───────────────────────────────────────────────────────

function shiftLeft3(raw: Uint8Array): number[] {
  const result: number[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const curr = raw[i];
    const next = i + 1 < raw.length ? raw[i + 1] : 0;
    result[i] = ((curr << 3) | (next >> 5)) & 0xFF;
  }
  return result;
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: ActaEntry['status'] }) => {
  const styles: Record<string, React.CSSProperties> = {
    pending:   { background: 'rgba(255,255,255,0.06)', color: '#94a3b8' },
    scanned:   { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
    confirmed: { background: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    error:     { background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  };
  const labels = { pending: 'PENDIENTE', scanned: 'ESCANEADO', confirmed: 'CONFIRMADO', error: 'ERROR' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '6px',
      fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.08em',
      ...styles[status]
    }}>
      {labels[status]}
    </span>
  );
};

// ─── QR SCANNER MODAL ────────────────────────────────────────────────────────

const QRScannerModal = ({
  cargoLabel, onScan, onClose
}: { cargoLabel: string; onScan: (text: string) => void; onClose: () => void }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');

  useEffect(() => {
    if (mode !== 'camera') return;
    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'acta-qr-reader',
          { fps: 15, qrbox: { width: 280, height: 280 }, rememberLastUsedCamera: true, videoConstraints: { facingMode: 'environment' } },
          false
        );
        scanner.render(
          (decodedText) => {
            scanner.clear().catch(() => {});
            onScan(decodedText);
          },
          () => {}
        );
        scannerRef.current = scanner;
      } catch {}
    }, 300);
    return () => {
      clearTimeout(timer);
      scannerRef.current?.clear().catch(() => {});
    };
  }, [mode, onScan]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
    }}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          width: '100%', maxWidth: '440px',
          background: 'var(--surface-light)', borderRadius: '24px',
          border: '1px solid var(--border)', overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--plra-300)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
              ESCANEAR ACTA
            </p>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>{cargoLabel}</h3>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.08)', border: 'none',
            borderRadius: '10px', padding: '0.5rem', cursor: 'pointer', color: 'white'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{ padding: '1rem 1.5rem 0', display: 'flex', gap: '0.5rem' }}>
          {(['camera', 'manual'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '0.5rem', borderRadius: '10px',
              border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem',
              background: mode === m ? 'var(--plra-500)' : 'rgba(255,255,255,0.06)',
              color: mode === m ? 'white' : 'var(--text-3)',
            }}>
              {m === 'camera' ? '📷 Cámara' : '⌨️ Manual'}
            </button>
          ))}
        </div>

        {/* Camera or manual */}
        <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
          {mode === 'camera' ? (
            <div id="acta-qr-reader" style={{ borderRadius: '16px', overflow: 'hidden' }} />
          ) : (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                Pega el texto del QR (empieza con "REC "):
              </p>
              <textarea
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="REC FA..."
                style={{
                  width: '100%', height: '90px', borderRadius: '12px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                  color: 'white', fontFamily: 'monospace', fontSize: '0.75rem',
                  padding: '0.75rem', outline: 'none', resize: 'none', boxSizing: 'border-box'
                }}
              />
              <button
                onClick={() => manualInput.trim() && onScan(manualInput.trim())}
                disabled={!manualInput.trim()}
                style={{
                  width: '100%', marginTop: '0.75rem', padding: '0.85rem',
                  borderRadius: '14px', border: 'none',
                  background: manualInput.trim() ? 'var(--plra-500)' : 'rgba(255,255,255,0.06)',
                  color: 'white', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                Procesar QR
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── CONFIRM PANEL ────────────────────────────────────────────────────────────

const ConfirmPanel = ({
  acta, listas, onConfirm, onRetry, onClose, submitting
}: {
  acta: ActaEntry;
  listas: Lista[];
  onConfirm: (overrides: { blancos: number; nulos: number; votos: Record<string, number> }) => void;
  onRetry: () => void;
  onClose: () => void;
  submitting: boolean;
}) => {
  const def = CARGO_DEFINITIONS[acta.cargoKey];
  const parsed = acta.parsed!;

  const [blancos, setBlancos] = useState(parsed.blancos);
  const [nulos, setNulos] = useState(parsed.nulos);

  // Build initial votos state from parsed, keyed by list_number
  const initVotos: Record<string, number> = {};
  listas.forEach(l => {
    const key = String(l.list_number);
    initVotos[key] = parsed.votos[key] ?? parsed.votos[String(l.id)] ?? 0;
  });
  const [votos, setVotos] = useState<Record<string, number>>(initVotos);

  const sumListas = Object.values(votos).reduce((a, b) => a + b, 0);
  const sumTotal  = sumListas + blancos + nulos;
  const isBalanced = parsed.total === 0 || sumTotal === parsed.total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {/* Header */}
      <div style={{
        background: parsed.autoDecoded
          ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(0,71,171,0.15))'
          : 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(0,71,171,0.1))',
        borderRadius: '20px', padding: '1.5rem',
        border: `1px solid ${parsed.autoDecoded ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: parsed.autoDecoded ? '#22c55e' : '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
              {parsed.autoDecoded ? '✓ Decodificado Automáticamente' : '⚠️ Verificar Manualmente'}
            </p>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white' }}>{def.label}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        {parsed.mesaId && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.5rem', fontFamily: 'monospace' }}>
            Mesa ID: {parsed.mesaId.toUpperCase()}
          </p>
        )}
        {!parsed.autoDecoded && (
          <div style={{
            marginTop: '0.75rem', padding: '0.75rem', borderRadius: '12px',
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)'
          }}>
            <p style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 700 }}>
              Este cargo usa una codificación compleja. Verificá y completá los votos manualmente antes de confirmar.
            </p>
          </div>
        )}
      </div>

      {/* Blancos / Nulos / Total */}
      <div style={{
        background: 'var(--surface-light)', borderRadius: '20px', padding: '1.5rem',
        border: '1px solid var(--border)'
      }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
          Resumen del Acta
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Blancos', value: blancos, set: setBlancos, color: '#94a3b8' },
            { label: 'Nulos', value: nulos, set: setNulos, color: '#ef4444' },
          ].map(({ label, value, set, color }) => (
            <div key={label} style={{
              background: 'rgba(0,0,0,0.2)', borderRadius: '14px', padding: '0.85rem',
              textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <p style={{ fontSize: '0.65rem', color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{label}</p>
              <input
                type="number"
                min={0}
                value={value}
                onChange={e => set(Math.max(0, parseInt(e.target.value) || 0))}
                style={{
                  width: '100%', textAlign: 'center', background: 'transparent',
                  border: 'none', color: 'white', fontSize: '1.8rem', fontWeight: 900,
                  outline: 'none', padding: 0
                }}
              />
            </div>
          ))}
          <div style={{
            background: `rgba(${isBalanced ? '34,197,94' : '239,68,68'},0.08)`,
            borderRadius: '14px', padding: '0.85rem',
            textAlign: 'center',
            border: `1px solid rgba(${isBalanced ? '34,197,94' : '239,68,68'},0.2)`
          }}>
            <p style={{ fontSize: '0.65rem', color: isBalanced ? '#22c55e' : '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Total
            </p>
            <p style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{sumTotal}</p>
            {parsed.total > 0 && !isBalanced && (
              <p style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 700, marginTop: '0.25rem' }}>
                esperado: {parsed.total}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Votes per list */}
      <div style={{
        background: 'var(--surface-light)', borderRadius: '20px', padding: '1.5rem',
        border: '1px solid var(--border)'
      }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
          Votos por Lista
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {listas.map(l => {
            const key = String(l.list_number);
            const val = votos[key] ?? 0;
            return (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.9rem 1rem', borderRadius: '16px',
                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '1rem', fontWeight: 900, color: 'white' }}>{l.nombre}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 700 }}>LISTA {l.list_number}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  value={val}
                  onChange={e => {
                    const n = Math.max(0, parseInt(e.target.value) || 0);
                    setVotos(prev => ({ ...prev, [key]: n }));
                  }}
                  style={{
                    width: '72px', textAlign: 'center',
                    background: 'rgba(255,255,255,0.06)',
                    border: val > 0 ? `2px solid ${l.color}40` : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', color: 'white',
                    fontSize: '1.5rem', fontWeight: 900, padding: '0.4rem 0',
                    outline: 'none'
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={onRetry}
          style={{
            flex: 1, padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)',
            background: 'transparent', color: 'white', fontWeight: 800, fontSize: '0.85rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}
        >
          <RotateCcw size={16} /> Re-escanear
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onConfirm({ blancos, nulos, votos })}
          disabled={submitting}
          style={{
            flex: 2, padding: '1rem', borderRadius: '14px', border: 'none',
            background: 'linear-gradient(135deg, var(--plra-500), var(--plra-600))',
            color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: '0 4px 20px rgba(0,71,171,0.4)',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? <Loader size={18} className="spin" /> : <Check size={18} />}
          Confirmar y Guardar
        </motion.button>
      </div>
    </motion.div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const ActaScanner = () => {
  const { user } = useAuth();
  const [listas, setListas] = useState<Lista[]>([]);
  const [localesMesas, setLocalesMesas] = useState<{ nombre: string; mesas: number[] }[]>([]);
  const [selectedLocal, setSelectedLocal] = useState<string>('');
  const [selectedMesa, setSelectedMesa] = useState<number>(0);
  const [mesaId, setMesaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Acta tracking
  const [actas, setActas] = useState<ActaEntry[]>(
    CARGO_ORDER.map(k => ({ cargoKey: k, label: CARGO_DEFINITIONS[k].label, status: 'pending' }))
  );
  const [activeCargo, setActiveCargo] = useState<string | null>(null);
  const [scanningCargo, setScanningCargo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/diad/listas'),
      api.get('/veedor/locales-mesas'),
    ]).then(([listasRes, localesRes]) => {
      setListas(listasRes.data);
      setLocalesMesas(localesRes.data);
      // Restore saved local selection
      const savedLocal = localStorage.getItem('veedor_selected_local') || '';
      const firstLocal = localesRes.data[0]?.nombre || '';
      setSelectedLocal(savedLocal && localesRes.data.find((l: any) => l.nombre === savedLocal) ? savedLocal : firstLocal);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleScan = useCallback(async (rawQR: string, cargoKey: string) => {
    setScanningCargo(null);

    try {
      const res = await api.post('/veedor/parse-qr', { qrData: rawQR });
      const data = res.data;

      if (!data.success) {
        setActas(prev => prev.map(a => a.cargoKey === cargoKey
          ? { ...a, status: 'error', error: 'No se pudo decodificar el QR.' }
          : a));
        return;
      }

      // Detect cargo from the QR cargoByte; fall back to the one user tapped
      const detectedCargoKey = data.cargo_byte !== undefined ? BYTE_TO_CARGO[data.cargo_byte] : undefined;
      const finalCargoKey = detectedCargoKey ?? cargoKey;

      const def = CARGO_DEFINITIONS[finalCargoKey];
      const autoDecoded = data.autoDecodable ?? def?.autoDecodable ?? false;

      const parsed: ParsedActa = {
        cargo: finalCargoKey,
        cargo_byte: data.cargo_byte,
        mesaId: data.mesaId,
        blancos: data.blancos ?? 0,
        nulos: data.nulos ?? 0,
        total: data.total ?? 0,
        votos: data.votos ?? {},
        autoDecoded,
      };

      setActas(prev => prev.map(a => a.cargoKey === finalCargoKey
        ? { ...a, status: 'scanned', parsed }
        : a));
      setActiveCargo(finalCargoKey);
    } catch (e: any) {
      setActas(prev => prev.map(a => a.cargoKey === cargoKey
        ? { ...a, status: 'error', error: e?.response?.data?.error ?? e.message }
        : a));
    }
  }, []);

  const handleConfirm = useCallback(async (
    cargoKey: string,
    overrides: { blancos: number; nulos: number; votos: Record<string, number> }
  ) => {
    if (!selectedLocal) { alert('Seleccioná un local de votación primero.'); return; }
    setSubmitting(true);

    const def = CARGO_DEFINITIONS[cargoKey];
    const mesaNum = localesMesas.find(l => l.nombre === selectedLocal)?.mesas[0] ?? 1;
    const listasPayload = listas.map(l => ({
      lista_id: l.id,
      votos: overrides.votos[String(l.list_number)] ?? overrides.votos[String(l.id)] ?? 0
    }));

    try {
      const payload = {
        mesa_id: mesaNum, // backend ignores this and uses user's assigned_mesa; kept for compatibility
        votos_blanco: overrides.blancos,
        votos_nulos: overrides.nulos,
        listas: JSON.stringify(listasPayload),
        category: def.category,
        local_votacion: selectedLocal,
        mesa: mesaNum,
      };

      if (isOnline) {
        await api.post('/diad/acta', payload);
      } else {
        const { safePost } = await import('../services/syncService');
        await safePost('SUBMIT_ACTA', '/diad/acta', payload);
      }

      setActas(prev => prev.map(a => a.cargoKey === cargoKey ? { ...a, status: 'confirmed' } : a));
      setActiveCargo(null);
    } catch (e: any) {
      alert('Error al guardar el acta: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setSubmitting(false);
    }
  }, [selectedLocal, localesMesas, listas, isOnline]);

  const confirmed = actas.filter(a => a.status === 'confirmed').length;
  const total11   = actas.length;

  if (loading) {
    return (
      <MainLayout title="Escaneo de Actas" userName={user?.nombre || ''}>
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <Loader size={32} style={{ color: 'var(--plra-300)', animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Escaneo de Actas" userName={user?.nombre || ''}>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      <div style={{ padding: '1rem', maxWidth: '720px', margin: '0 auto', paddingBottom: '3rem' }}>

        {/* ── TOP HEADER ────────────────────────────────────── */}
        <div style={{ marginBottom: '1.25rem' }}>
          {/* Online indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.85rem', borderRadius: '999px',
            background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            width: 'fit-content', marginBottom: '1rem'
          }}>
            {isOnline ? <Wifi size={13} color="#22c55e" /> : <WifiOff size={13} color="#ef4444" />}
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isOnline ? '#22c55e' : '#ef4444' }}>
              {isOnline ? 'En línea' : 'Sin conexión — guardando offline'}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            background: 'var(--surface-light)', borderRadius: '20px',
            padding: '1.5rem', border: '1px solid var(--border)',
            display: 'flex', gap: '1.5rem', alignItems: 'center'
          }}>
            <div>
              <p style={{ fontSize: '3rem', fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>{confirmed}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                de {total11} actas
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '10px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <motion.div
                  animate={{ width: `${(confirmed / total11) * 100}%` }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, var(--plra-400), #22c55e)', borderRadius: '999px' }}
                />
              </div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-3)' }}>
                {confirmed === total11 ? '🎉 ¡Todas las actas registradas!' : `${total11 - confirmed} actas pendientes`}
              </p>
            </div>
            <FileText size={28} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
          </div>
        </div>

        {/* ── LOCAL SELECTOR ───────────────────────────────────── */}
        <div className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <MapPin size={16} style={{ color: 'var(--plra-300)' }} />
            <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Local de Votación
            </h3>
          </div>
          <select
            value={selectedLocal}
            onChange={e => {
              const val = e.target.value;
              setSelectedLocal(val);
              localStorage.setItem('veedor_selected_local', val);
            }}
            style={{
              width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              color: 'white', fontWeight: 700, outline: 'none', fontSize: '0.9rem'
            }}
          >
            {localesMesas.map(l => (
              <option key={l.nombre} value={l.nombre} style={{ background: '#1a1a2e' }}>{l.nombre}</option>
            ))}
          </select>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
            La mesa se identifica automáticamente desde el código QR de cada acta.
          </p>
        </div>

        {/* ── ACTA LIST ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeCargo ? (
            // CONFIRM PANEL VIEW
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button
                onClick={() => setActiveCargo(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'transparent', border: 'none', color: 'var(--text-3)',
                  cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', marginBottom: '1rem'
                }}
              >
                <ChevronLeft size={18} /> Volver a la lista
              </button>
              <ConfirmPanel
                acta={actas.find(a => a.cargoKey === activeCargo)!}
                listas={listas}
                onConfirm={(overrides) => handleConfirm(activeCargo, overrides)}
                onRetry={() => { setScanningCargo(activeCargo); setActiveCargo(null); }}
                onClose={() => setActiveCargo(null)}
                submitting={submitting}
              />
            </motion.div>
          ) : (
            // LIST VIEW
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {actas.map((acta, idx) => {
                  const isDone = acta.status === 'confirmed';
                  const isError = acta.status === 'error';
                  const isScanned = acta.status === 'scanned';
                  const isPending = acta.status === 'pending';

                  return (
                    <motion.div
                      key={acta.cargoKey}
                      layout
                      style={{
                        background: isDone
                          ? 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(0,71,171,0.08))'
                          : isScanned
                          ? 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(0,71,171,0.08))'
                          : 'var(--surface-light)',
                        borderRadius: '18px',
                        border: `1px solid ${isDone ? 'rgba(34,197,94,0.2)' : isScanned ? 'rgba(251,191,36,0.2)' : isError ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                        padding: '1.1rem 1.25rem',
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        cursor: isDone ? 'default' : 'pointer',
                        opacity: isDone ? 0.7 : 1,
                      }}
                      onClick={() => {
                        if (isDone) return;
                        if (isScanned) { setActiveCargo(acta.cargoKey); return; }
                        setScanningCargo(acta.cargoKey);
                      }}
                      whileHover={isDone ? {} : { scale: 1.01 }}
                      whileTap={isDone ? {} : { scale: 0.99 }}
                    >
                      {/* Number badge */}
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
                        background: isDone ? 'rgba(34,197,94,0.15)' : isScanned ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isDone
                          ? <CheckCircle size={20} color="#22c55e" />
                          : isScanned
                          ? <AlertTriangle size={20} color="#fbbf24" />
                          : <span style={{ fontWeight: 900, color: 'var(--text-3)', fontSize: '0.9rem' }}>{idx + 1}</span>
                        }
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 900, color: 'white', fontSize: '0.95rem', lineHeight: 1.3 }}>
                          {acta.label}
                        </p>
                        {isError && (
                          <p style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700, marginTop: '0.2rem' }}>
                            {acta.error}
                          </p>
                        )}
                        {isScanned && (
                          <p style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, marginTop: '0.2rem' }}>
                            Toca para revisar y confirmar →
                          </p>
                        )}
                      </div>

                      {/* Status + action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <StatusBadge status={acta.status} />
                        {!isDone && (
                          isScanned
                            ? <ChevronRight size={18} color="#fbbf24" />
                            : <QrCode size={18} color="var(--text-3)" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* All done banner */}
              <AnimatePresence>
                {confirmed === total11 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      marginTop: '1.5rem', padding: '2rem',
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(0,71,171,0.2))',
                      borderRadius: '24px', border: '1px solid rgba(34,197,94,0.3)',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>
                      ¡Todas las actas registradas!
                    </h3>
                    <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
                      Mesa {selectedMesa} — {selectedLocal}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── QR SCANNER MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {scanningCargo && (
          <QRScannerModal
            cargoLabel={CARGO_DEFINITIONS[scanningCargo]?.label ?? scanningCargo}
            onScan={(text) => handleScan(text, scanningCargo)}
            onClose={() => setScanningCargo(null)}
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default ActaScanner;
