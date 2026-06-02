import React, { useState, useEffect } from 'react';
import { X, Search, CheckSquare, Square, ChevronRight, UserCheck, Shield, Award, Users } from 'lucide-react';
import api from '../../services/api';

interface Assistant {
  id: number;
  ci: string;
  nombre: string;
  apellido: string;
  distrito: string;
  cargo: string;
  telefono: string;
  photo_url?: string;
  timestamp: string;
}

interface BulkImportAssistantsModalProps {
  lists: any[];
  users: any[];
  campaigns: any[];
  onClose: () => void;
  onSuccess: () => void;
}

const BulkImportAssistantsModal: React.FC<BulkImportAssistantsModalProps> = ({
  lists,
  users,
  campaigns,
  onClose,
  onSuccess
}) => {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selection and mapping states
  const [selectedCis, setSelectedCis] = useState<string[]>([]);
  const [targetRole, setTargetRole] = useState<'ASISTENTE_DEFAULT' | 'COORDINADOR' | 'PADRINO' | 'SUBJEFE' | 'JEFE_CAMPANA'>('ASISTENTE_DEFAULT');
  const [assignedListId, setAssignedListId] = useState<string>('');
  const [parentId, setParentId] = useState<string>('');
  const [assignedDistrito, setAssignedDistrito] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');

  useEffect(() => {
    fetchNonUsersAssistants();
  }, []);

  const fetchNonUsersAssistants = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch all registered assistants
      const res = await api.get('/attendance/list');
      const allAssistants: Assistant[] = res.data;

      // 2. Filter out those who are already users in the system
      const existingCis = new Set(users.map(u => u.username?.toString().trim()));
      const nonUsers = allAssistants.filter(a => !existingCis.has(a.ci.trim()));

      setAssistants(nonUsers);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al obtener la lista de asistentes.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (ci: string) => {
    setSelectedCis(prev =>
      prev.includes(ci) ? prev.filter(c => c !== ci) : [...prev, ci]
    );
  };

  const handleSelectAll = (filteredList: Assistant[]) => {
    const filteredCis = filteredList.map(a => a.ci);
    const allSelected = filteredCis.every(ci => selectedCis.includes(ci));

    if (allSelected) {
      setSelectedCis(prev => prev.filter(ci => !filteredCis.includes(ci)));
    } else {
      setSelectedCis(prev => Array.from(new Set([...prev, ...filteredCis])));
    }
  };

  const handleBulkImport = async () => {
    if (selectedCis.length === 0) {
      alert('Por favor, seleccione al menos un asistente.');
      return;
    }

    if (!targetRole) {
      alert('Debe especificar el Rol de destino.');
      return;
    }

    setSubmitting(false);
    const confirmMsg = `¿Está seguro de convertir de forma masiva a los ${selectedCis.length} asistentes seleccionados en usuarios del sistema?`;
    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const { data } = await api.post('/attendance/assign-massively', {
        cis: selectedCis,
        role: targetRole,
        list_id: assignedListId ? parseInt(assignedListId) : null,
        parent_id: parentId ? parseInt(parentId) : null,
        distrito: assignedDistrito || null
      });

      alert(`✅ PROCESO COMPLETADO:\n\nUsuarios creados: ${data.created}\nOmitidos (ya existían): ${data.skipped}`);
      onSuccess();
    } catch (err: any) {
      alert('Error en la asignación masiva: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter list locally
  const filteredAssistants = assistants.filter(a => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      `${a.nombre} ${a.apellido || ''}`.toLowerCase().includes(searchLower) ||
      a.ci.includes(searchLower) ||
      a.telefono.includes(searchLower);

    const matchesDistrict = !districtFilter || a.distrito.toUpperCase() === districtFilter.toUpperCase();

    return matchesSearch && matchesDistrict;
  });

  const districtsList = Array.from(new Set(assistants.map(a => a.distrito).filter(Boolean))).sort();

  return (
    <div style={{ width: '800px', maxWidth: '95vw', display: 'flex', flexDirection: 'column' }}>
      <div className="modal-header-premium">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '8px', background: 'rgba(59,130,246,0.1)', borderRadius: '10px', color: 'var(--plra-300)' }}>
            <Users size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Conversión Masiva de Asistentes</h2>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-3)' }}>
              Seleccione asistentes presenciales y conviértalos en operadores de sistema asignando datos masivamente.
            </p>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body-premium" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', padding: '1.5rem', maxHeight: '75vh', overflow: 'hidden' }}>
        
        {/* Left Side: Search, Filters & Assistant Selection Table */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                className="mini-input"
                style={{ paddingLeft: '30px', width: '100%', height: '36px' }}
                placeholder="Buscar asistente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="mini-input"
              style={{ width: '150px', height: '36px' }}
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
            >
              <option value="">Todos los Distritos</option>
              {districtsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>Cargando asistentes...</div>
            ) : error ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--red)' }}>{error}</div>
            ) : filteredAssistants.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>No se encontraron asistentes pendientes.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', width: '30px', textAlign: 'center' }}>
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: 'var(--plra-300)', cursor: 'pointer', padding: 0 }}
                        onClick={() => handleSelectAll(filteredAssistants)}
                      >
                        {filteredAssistants.every(a => selectedCis.includes(a.ci)) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Nombre</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Cédula</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Distrito</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssistants.map(a => {
                    const isSelected = selectedCis.includes(a.ci);
                    return (
                      <tr
                        key={a.id}
                        onClick={() => handleToggleSelect(a.ci)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ color: isSelected ? 'var(--plra-300)' : 'var(--text-3)' }}>
                            {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{a.nombre} {a.apellido}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>{parseInt(a.ci).toLocaleString('es-PY')}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-2)' }}>{a.distrito}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-3)' }}>
            Seleccionados: <strong style={{ color: 'var(--plra-300)' }}>{selectedCis.length}</strong> de {filteredAssistants.length} asistentes mostrados.
          </div>
        </div>

        {/* Right Side: Bulk Configuration Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Award size={15} /> Asignación de Atributos Masivos
          </h3>

          {/* District assignment */}
          <div className="form-group">
            <label>Distrito/Ciudad Masivo (Opcional)</label>
            <input
              className="modern-input-premium-styled"
              placeholder="Ej: PEDRO JUAN CABALLERO"
              value={assignedDistrito}
              onChange={e => setAssignedDistrito(e.target.value.toUpperCase())}
              list="districts-list"
            />
            <span style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>Dejar en blanco para conservar el distrito de asistencia de cada uno.</span>
          </div>

          {/* Role selection */}
          <div className="form-group">
            <label>Rol del Sistema Asignado</label>
            <select
              className="modern-input-premium-styled"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value as any)}
            >
              <option value="ASISTENTE_DEFAULT">(Recomendado) Usar Cargo de Asistencia (Apoderado / Miembro de Mesa)</option>
              <option value="COORDINADOR">Coordinador de Campo</option>
              <option value="PADRINO">Padrino</option>
              <option value="SUBJEFE">Sub-Jefe (Líder de Lista)</option>
              <option value="JEFE_CAMPANA">Jefe de Campaña</option>
            </select>
          </div>

          {/* Parent assignment selection */}
          <div className="form-group">
            <label>Superior / Supervisor (Padrino o Jefe)</label>
            <select
              className="modern-input-premium-styled"
              value={parentId}
              onChange={e => setParentId(e.target.value)}
            >
              <option value="">Seleccione Superior...</option>
              {users.filter(u => {
                if (targetRole === 'SUBJEFE') return u.role === 'JEFE_CAMPANA';
                if (targetRole === 'PADRINO') return u.role === 'JEFE_CAMPANA';
                return u.role === 'PADRINO' || u.role === 'SUBJEFE';
              }).map(u => (
                <option key={u.id} value={u.id}>{u.nombre} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* List selection */}
          <div className="form-group">
            <label>Lista Electoral Asignada Masivamente</label>
            <select
              className="modern-input-premium-styled"
              value={assignedListId}
              onChange={e => setAssignedListId(e.target.value)}
            >
              <option value="">Seleccione una lista...</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>
                  {l.list_number} {l.type === 'CONCEJAL' ? `Op${l.option_number}` : '(Int.)'} — {l.candidate_alias || l.candidate_nombre}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>Obligatorio para que puedan interactuar con capturas.</span>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-cancel-styled" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="btn-confirm-styled"
              onClick={handleBulkImport}
              disabled={submitting || selectedCis.length === 0}
              style={{ minWidth: '150px' }}
            >
              {submitting ? 'Procesando...' : `Convertir a Usuario (${selectedCis.length})`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BulkImportAssistantsModal;
