import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SEATS_BY_CARGO } from '../../utils/seats';

const CARGO_LABELS: Record<number, string> = {
  2:  'Junta Municipal',
  4:  'Directorio Nacional',
  5:  'Directorio Departamental',
  6:  'Comite Local',
  7:  'Convencional',
  9:  'Conduccion Nac. JLRA',
  10: 'Representante Deptal JLRA',
  11: 'Bancas Filiales',
  12: 'Miembro Convencional JLRA',
};

interface Props {
  initialSeats?: Record<string, number>;
  initialNombre?: string;
  initialDesc?: string;
  onSave: (nombre: string, descripcion: string, seats: Record<string, number>) => Promise<void>;
  onCancel: () => void;
  title: string;
}

const NewScenarioModal: React.FC<Props> = ({ initialSeats, initialNombre = '', initialDesc = '', onSave, onCancel, title }) => {
  const [nombre, setNombre] = useState(initialNombre);
  const [desc, setDesc] = useState(initialDesc);
  const [seats, setSeats] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    Object.entries(SEATS_BY_CARGO).forEach(([k, v]) => { base[k] = initialSeats?.[k] ?? v; });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleSeatChange = (cod: string, val: string) => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 0 || n > 100) return;
    setSeats(prev => ({ ...prev, [cod]: n }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(nombre.trim(), desc.trim(), seats);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al guardar el escenario.');
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)', fontSize: '0.8rem', boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh',
        overflowY: 'auto', padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{title}</h3>
          <button onClick={onCancel} style={{ border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.3rem' }}>
              Nombre *
            </label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Nombre del escenario" autoFocus />
          </div>

          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.3rem' }}>
              Descripcion
            </label>
            <input value={desc} onChange={e => setDesc(e.target.value)} style={inputStyle} placeholder="Descripcion opcional" />
          </div>

          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>
              Bancas por cargo
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.entries(CARGO_LABELS).map(([cod, label]) => (
                <div key={cod} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', flex: 1 }}>{label}</span>
                  <input
                    type="number" min={0} max={100}
                    value={seats[cod] ?? SEATS_BY_CARGO[Number(cod)] ?? 0}
                    onChange={e => handleSeatChange(cod, e.target.value)}
                    style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '0.3rem 0.4rem' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ color: '#EF4444', fontSize: '0.75rem', margin: 0 }}>{error}</p>
          )}

          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>
            Los escenarios son visibles para todo el equipo.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel}
              style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: 'none', background: saving ? 'rgba(21,88,176,0.5)' : 'var(--plra-500, #1558B0)', color: 'white', fontSize: '0.75rem', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewScenarioModal;
