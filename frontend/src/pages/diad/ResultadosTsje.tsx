import React, { useReducer, useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tsjeApi, TSJE_DISTRICTS, districtForName } from '../../services/tsjeService';
import type { TsjeResultado, TsjeScenario, TsjeDistrict } from '../../services/tsjeService';
import { SEATS_BY_CARGO } from '../../utils/seats';
import CargoCard from '../../components/diad/CargoCard';
import ScenarioSelector from '../../components/diad/ScenarioSelector';

// ── Scenario state ────────────────────────────────────────────────────────────

type ScenarioState = {
  scenarios: TsjeScenario[];
  selectedId: number | null;
  seatsDraft: Record<string, number>;
  isDirty: boolean;
};

type ScenarioAction =
  | { type: 'LOAD'; scenarios: TsjeScenario[] }
  | { type: 'SELECT'; id: number }
  | { type: 'SEAT_CHANGE'; cod: string; value: number }
  | { type: 'CREATED'; scenario: TsjeScenario }
  | { type: 'UPDATED'; scenario: TsjeScenario }
  | { type: 'DELETED'; id: number };

function defaultSeats(scenario: TsjeScenario | undefined): Record<string, number> {
  if (scenario) {
    const base: Record<string, number> = {};
    Object.entries(SEATS_BY_CARGO).forEach(([k, v]) => { base[k] = scenario.seats[k] ?? v; });
    return base;
  }
  const base: Record<string, number> = {};
  Object.entries(SEATS_BY_CARGO).forEach(([k, v]) => { base[k] = v; });
  return base;
}

function scenarioReducer(state: ScenarioState, action: ScenarioAction): ScenarioState {
  switch (action.type) {
    case 'LOAD': {
      const first = action.scenarios[0] ?? null;
      return {
        scenarios: action.scenarios,
        selectedId: first?.id ?? null,
        seatsDraft: defaultSeats(first ?? undefined),
        isDirty: false,
      };
    }
    case 'SELECT': {
      const s = state.scenarios.find(x => x.id === action.id);
      return { ...state, selectedId: action.id, seatsDraft: defaultSeats(s), isDirty: false };
    }
    case 'SEAT_CHANGE':
      return { ...state, seatsDraft: { ...state.seatsDraft, [action.cod]: action.value }, isDirty: true };
    case 'CREATED':
      return {
        ...state,
        scenarios: [...state.scenarios, action.scenario],
        selectedId: action.scenario.id,
        seatsDraft: defaultSeats(action.scenario),
        isDirty: false,
      };
    case 'UPDATED': {
      const scenarios = state.scenarios.map(s => s.id === action.scenario.id ? action.scenario : s);
      const selected = state.selectedId === action.scenario.id;
      return {
        ...state,
        scenarios,
        seatsDraft: selected ? defaultSeats(action.scenario) : state.seatsDraft,
        isDirty: selected ? false : state.isDirty,
      };
    }
    case 'DELETED': {
      const scenarios = state.scenarios.filter(s => s.id !== action.id);
      const newSelected = scenarios[0] ?? null;
      if (state.selectedId === action.id) {
        return { ...state, scenarios, selectedId: newSelected?.id ?? null, seatsDraft: defaultSeats(newSelected ?? undefined), isDirty: false };
      }
      return { ...state, scenarios };
    }
    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const parsePY = (dt: string | null | undefined) => {
  if (!dt) return null;
  return new Date(dt.includes('Z') ? dt : dt + 'Z');
};
const fmtDateTime = (dt: string | null | undefined) => {
  const d = parsePY(dt);
  if (!d) return '';
  return d.toLocaleString('es-PY', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion',
  });
};

// ── Component ─────────────────────────────────────────────────────────────────

const ResultadosTsje: React.FC = () => {
  const { user } = useAuth();

  const canEdit = user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA';

  // District selection
  const [selectedDistrict, setSelectedDistrict] = useState<TsjeDistrict | null>(() => {
    return districtForName(user?.distrito) ?? TSJE_DISTRICTS[0];
  });

  // Cargo filter
  const [filterCargo, setFilterCargo] = useState<number | null>(null);

  // Data
  const [resultados, setResultados] = useState<TsjeResultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');   // progress message shown to user
  const [syncError, setSyncError] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Scenarios
  const [scenState, dispatch] = useReducer(scenarioReducer, {
    scenarios: [], selectedId: null, seatsDraft: defaultSeats(undefined), isDirty: false,
  });

  // ── Load resultados ──
  const fetchResultados = useCallback(async () => {
    if (!selectedDistrict) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await tsjeApi.getResultados(selectedDistrict.cod_dpto, selectedDistrict.cod_distrito);
      setResultados(data);
    } catch {
      setLoadError('Error al cargar resultados. Verificar conexion.');
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict]);

  useEffect(() => { fetchResultados(); }, [fetchResultados]);

  // ── Load sync status ──
  useEffect(() => {
    if (!selectedDistrict) return;
    tsjeApi.getSyncStatus(selectedDistrict.cod_dpto, selectedDistrict.cod_distrito)
      .then(s => setLastSync(s.lastSync))
      .catch(() => {});
  }, [selectedDistrict, resultados]);

  // ── Load scenarios once ──
  useEffect(() => {
    tsjeApi.getScenarios()
      .then(scenarios => dispatch({ type: 'LOAD', scenarios }))
      .catch(() => {});
  }, []);

  // ── Sync handler (fire-and-forget + polling) ──
  const handleSync = async () => {
    if (!selectedDistrict) return;
    setSyncing(true);
    setSyncError('');
    setSyncMsg('Iniciando sincronizacion...');
    try {
      await tsjeApi.triggerSync(selectedDistrict.cod_dpto, selectedDistrict.cod_distrito);
    } catch (e: any) {
      const serverMsg = e?.response?.data?.error;
      // 409 = ya hay un sync corriendo — tratar como "en curso"
      if (e?.response?.status === 409) {
        setSyncMsg('Sincronizacion ya en curso, esperando...');
      } else {
        setSyncError(serverMsg || 'No se pudo iniciar la sincronizacion.');
        setSyncing(false);
        setSyncMsg('');
        return;
      }
    }
    // Polling hasta que el servidor termine
    setSyncMsg('Sincronizando con TSJE (puede tardar varios minutos)...');
    const { error } = await tsjeApi.pollUntilDone(selectedDistrict.cod_dpto, selectedDistrict.cod_distrito);
    if (error) {
      setSyncError(`La sincronizacion termino con errores: ${error}`);
    } else {
      setSyncMsg('');
      await fetchResultados();
    }
    setSyncing(false);
    setSyncMsg('');
  };

  // ── Filtered resultados ──
  const filtered = useMemo(() => {
    let list = [...resultados].sort((a, b) => a.cod_cargo - b.cod_cargo);
    if (filterCargo !== null) list = list.filter(r => r.cod_cargo === filterCargo);
    return list;
  }, [resultados, filterCargo]);

  // ── Group results by cod_cargo ──
  const groupedCargos = useMemo(() => {
    const groups: Record<number, TsjeResultado[]> = {};
    filtered.forEach(r => {
      if (!groups[r.cod_cargo]) groups[r.cod_cargo] = [];
      groups[r.cod_cargo].push(r);
    });
    return Object.entries(groups)
      .map(([cod, list]) => ({ cod_cargo: Number(cod), scopes: list }))
      .sort((a, b) => a.cod_cargo - b.cod_cargo);
  }, [filtered]);

  // ── Cargo filter options ──
  const cargoOptions = useMemo(() => {
    const seen = new Set<number>();
    return resultados
      .filter(r => { if (seen.has(r.cod_cargo)) return false; seen.add(r.cod_cargo); return true; })
      .sort((a, b) => a.cod_cargo - b.cod_cargo);
  }, [resultados]);

  // ── Check if selected district is Amambay ──
  const isAmambay = selectedDistrict?.cod_dpto === 13;

  // ── Max fetched_at ──
  const maxFetchedAt = useMemo(() => {
    if (resultados.length === 0) return null;
    return resultados.reduce((max, r) => {
      if (!r.fetched_at) return max;
      return (!max || r.fetched_at > max) ? r.fetched_at : max;
    }, null as string | null);
  }, [resultados]);

  // ── Has plurinominal ──
  const hasPluri = filtered.some(r => r.tip_cargo === 2);

  const selectStyle: React.CSSProperties = {
    padding: '0.35rem 0.65rem', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Filter bar ── */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0.75rem 0', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center',
        marginBottom: '1rem',
      }}>
        {/* Distrito */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Distrito
          </label>
          <select
            value={selectedDistrict ? `${selectedDistrict.cod_dpto}-${selectedDistrict.cod_distrito}` : ''}
            onChange={e => {
              const [dpto, dist] = e.target.value.split('-').map(Number);
              const d = TSJE_DISTRICTS.find(x => x.cod_dpto === dpto && x.cod_distrito === dist) ?? null;
              setSelectedDistrict(d);
              setResultados([]);
              setFilterCargo(null);
            }}
            style={selectStyle}
          >
            <option value="">-- Seleccionar --</option>
            {TSJE_DISTRICTS.map(d => (
              <option key={`${d.cod_dpto}-${d.cod_distrito}`} value={`${d.cod_dpto}-${d.cod_distrito}`}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Candidatura */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Candidatura
          </label>
          <select
            value={filterCargo ?? ''}
            onChange={e => setFilterCargo(e.target.value === '' ? null : Number(e.target.value))}
            style={selectStyle}
            disabled={!selectedDistrict}
          >
            <option value="">Todas</option>
            {cargoOptions.map(r => (
              <option key={r.cod_cargo} value={r.cod_cargo}>{r.cod_cargo} — {r.des_cargo}</option>
            ))}
          </select>
        </div>

        {/* Local votacion — disabled V1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Local de votacion
          </label>
          <div title="Disponible cuando se sincronice por mesa">
            <select disabled style={{ ...selectStyle, opacity: 0.45, cursor: 'not-allowed' }}>
              <option>Todos</option>
            </select>
          </div>
        </div>

        {/* Mesa — disabled V1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Mesa
          </label>
          <div title="Disponible cuando se sincronice por mesa">
            <select disabled style={{ ...selectStyle, opacity: 0.45, cursor: 'not-allowed' }}>
              <option>Todas</option>
            </select>
          </div>
        </div>

        {/* Sync controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          {syncMsg && (
            <span style={{ fontSize: '0.6rem', color: '#F59E0B', alignSelf: 'center', fontWeight: 700 }}>
              {syncMsg}
            </span>
          )}
          {!syncMsg && maxFetchedAt && (
            <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', alignSelf: 'center' }}>
              TSJE: {fmtDateTime(maxFetchedAt)}
            </span>
          )}
          {canEdit && selectedDistrict && (
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.85rem', borderRadius: '8px', border: 'none',
                background: syncing ? 'rgba(21,88,176,0.5)' : 'var(--plra-500, #1558B0)',
                color: 'white', fontSize: '0.65rem', fontWeight: 800, cursor: syncing ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? 'Sincronizando...' : 'Sincronizar desde TSJE'}
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {(syncError || loadError) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.65rem 1rem', borderRadius: '10px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#EF4444', fontSize: '0.75rem',
        }}>
          <AlertCircle size={14} />
          {syncError || loadError}
        </div>
      )}

      {/* ── Empty: no district ── */}
      {!selectedDistrict && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4rem 2rem', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', gap: '0.75rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>🗺</div>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-2)' }}>
            Selecciona un distrito para ver resultados
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            Los resultados se filtran por distrito. Usa el selector de arriba.
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {selectedDistrict && loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ width: '32px', height: '32px' }} />
        </div>
      )}

      {/* ── Empty: district selected but no data ── */}
      {selectedDistrict && !loading && resultados.length === 0 && !loadError && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4rem 2rem', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', gap: '0.75rem', textAlign: 'center',
        }}>
          <AlertCircle size={32} style={{ color: 'var(--text-3)', opacity: 0.5 }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-2)' }}>
            No hay datos sincronizados para {selectedDistrict.label}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {canEdit
              ? 'Usa el boton "Sincronizar desde TSJE" para cargar los datos.'
              : 'Pedile a un administrador que ejecute la sincronizacion.'}
          </p>
        </div>
      )}

      {/* ── Scenario selector (visible when there are plurinominal cargos) ── */}
      {selectedDistrict && !loading && hasPluri && scenState.scenarios.length > 0 && (
        <ScenarioSelector
          scenarios={scenState.scenarios}
          selectedId={scenState.selectedId}
          isDirty={scenState.isDirty}
          canEdit={canEdit}
          currentSeats={scenState.seatsDraft}
          onSelect={id => dispatch({ type: 'SELECT', id })}
          onCreated={scenario => dispatch({ type: 'CREATED', scenario })}
          onUpdated={scenario => dispatch({ type: 'UPDATED', scenario })}
          onDeleted={id => dispatch({ type: 'DELETED', id })}
        />
      )}

      {/* ── Cargo cards ── */}
      {selectedDistrict && !loading && groupedCargos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groupedCargos.map(g => {
            const bancas = scenState.seatsDraft[String(g.cod_cargo)] ?? SEATS_BY_CARGO[g.cod_cargo] ?? 0;

            return (
              <CargoCard
                key={g.cod_cargo}
                scopes={g.scopes}
                bancas={bancas}
                onBancasChange={(cod, v) => dispatch({ type: 'SEAT_CHANGE', cod: String(cod), value: v })}
              />
            );
          })}
        </div>
      )}

      {/* ── Empty: cargo filter returns nothing ── */}
      {selectedDistrict && !loading && resultados.length > 0 && filtered.length === 0 && filterCargo !== null && (
        <div style={{
          padding: '2rem', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
            Este cargo no tiene datos publicados aun por el TSJE.
          </p>
        </div>
      )}

    </div>
  );
};

export default ResultadosTsje;
