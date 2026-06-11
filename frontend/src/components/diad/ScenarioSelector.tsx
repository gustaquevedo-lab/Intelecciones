import React, { useState } from 'react';
import { Plus, Save, Edit2, Trash2 } from 'lucide-react';
import type { TsjeScenario } from '../../services/tsjeService';
import { tsjeApi } from '../../services/tsjeService';
import NewScenarioModal from './NewScenarioModal';

interface Props {
  scenarios: TsjeScenario[];
  selectedId: number | null;
  isDirty: boolean;
  canEdit: boolean;
  onSelect: (id: number) => void;
  onCreated: (s: TsjeScenario) => void;
  onUpdated: (s: TsjeScenario) => void;
  onDeleted: (id: number) => void;
  currentSeats: Record<string, number>;
}

const ScenarioSelector: React.FC<Props> = ({
  scenarios, selectedId, isDirty, canEdit,
  onSelect, onCreated, onUpdated, onDeleted, currentSeats,
}) => {
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selected = scenarios.find(s => s.id === selectedId) ?? null;

  const handleCreate = async (nombre: string, descripcion: string, seats: Record<string, number>) => {
    const s = await tsjeApi.createScenario({ nombre, descripcion, seats });
    onCreated(s);
    setShowNew(false);
  };

  const handleSaveChanges = async () => {
    if (!selected) return;
    const updated = await tsjeApi.updateScenario(selected.id, { seats: currentSeats });
    onUpdated(updated);
  };

  const handleRename = async (nombre: string, descripcion: string, seats: Record<string, number>) => {
    if (!selected) return;
    const updated = await tsjeApi.updateScenario(selected.id, { nombre, descripcion, seats });
    onUpdated(updated);
    setShowEdit(false);
  };

  const handleDelete = async () => {
    if (!selected || !window.confirm(`Eliminar escenario "${selected.nombre}"?`)) return;
    setDeleting(true);
    try {
      await tsjeApi.deleteScenario(selected.id);
      onDeleted(selected.id);
    } finally {
      setDeleting(false);
    }
  };

  const barStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--border)', borderRadius: '12px',
    flexWrap: 'wrap',
  };

  const btnStyle = (color?: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.3rem 0.65rem', borderRadius: '8px',
    border: `1px solid ${color ? `${color}40` : 'var(--border)'}`,
    background: color ? `${color}15` : 'rgba(255,255,255,0.04)',
    color: color ?? 'var(--text-3)',
    fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
  });

  return (
    <>
      <div style={barStyle}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
          Escenario:
        </span>

        <select
          value={selectedId ?? ''}
          onChange={e => onSelect(Number(e.target.value))}
          style={{
            padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.04)', color: 'var(--text)',
            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flex: '1 1 160px', maxWidth: '240px',
          }}
        >
          {scenarios.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}{s.id === selectedId && isDirty ? ' *' : ''}</option>
          ))}
        </select>

        {canEdit && (
          <>
            <button onClick={() => setShowNew(true)} style={btnStyle('#2E84F0')}>
              <Plus size={11} /> Nuevo
            </button>

            {isDirty && selected && (
              <button onClick={handleSaveChanges} style={btnStyle('#25C882')}>
                <Save size={11} /> Guardar cambios
              </button>
            )}

            {selected && (
              <button onClick={() => setShowEdit(true)} style={btnStyle()}>
                <Edit2 size={11} /> Renombrar
              </button>
            )}

            {selected && selected.nombre !== 'Hipotesis de referencia' && (
              <button onClick={handleDelete} disabled={deleting} style={btnStyle('#EF4444')}>
                <Trash2 size={11} /> {deleting ? '...' : 'Eliminar'}
              </button>
            )}
          </>
        )}
      </div>

      {showNew && (
        <NewScenarioModal
          title="Nuevo escenario"
          initialSeats={currentSeats}
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}

      {showEdit && selected && (
        <NewScenarioModal
          title="Editar escenario"
          initialNombre={selected.nombre}
          initialDesc={selected.descripcion ?? ''}
          initialSeats={Object.fromEntries(Object.entries(selected.seats).map(([k, v]) => [k, Number(v)]))}
          onSave={handleRename}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </>
  );
};

export default ScenarioSelector;
