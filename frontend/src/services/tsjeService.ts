import api from './api';

export const PLRA_2026 = 45;

export const TSJE_DISTRICTS = [
  { label: 'PEDRO JUAN CABALLERO', cod_dpto: 13, cod_distrito: 0 },
  { label: 'BELLA VISTA NORTE',    cod_dpto: 13, cod_distrito: 1 },
  { label: 'CAPITAN BADO',         cod_dpto: 13, cod_distrito: 3 },
  { label: 'ZANJA PYTA',           cod_dpto: 13, cod_distrito: 4 },
  { label: 'KARAPAI',              cod_dpto: 13, cod_distrito: 5 },
  { label: 'CERRO CORA',           cod_dpto: 13, cod_distrito: 6 },
] as const;

export type TsjeDistrict = typeof TSJE_DISTRICTS[number];

export function districtForName(name: string | null | undefined): TsjeDistrict | null {
  if (!name) return null;
  const norm = name.toUpperCase().trim();
  return TSJE_DISTRICTS.find(d => d.label === norm) ?? null;
}

export type TsjeListaResult = {
  num_lista: string;
  orden: number;
  des_partido: string;
  sig_partido: string;
  col_lista: string;
  votos: number;
};

export type TsjePrefResult = {
  num_lista: string;
  ord_candidato: number;
  nom_candidato: string;
  des_partido: string;
  orden: number;
  votos: number;
};

export type TsjeResultado = {
  cod_cargo: number;
  des_cargo: string;
  tip_cargo: number;
  niv_cargo: number;
  blancos: number;
  nulos: number;
  total_votos: number;
  electores: number;
  electores_publ: number;
  mesas_publicadas: number;
  total_mesas: number;
  no_computados: number;
  fetched_at: string;
  listas: TsjeListaResult[];
  preferentes: TsjePrefResult[];
};

export type TsjeScenario = {
  id: number;
  nombre: string;
  descripcion: string | null;
  seats: Record<string, number>;
  created_at: string;
};

export const tsjeApi = {
  getResultados: (codDpto: number, codDistrito: number): Promise<TsjeResultado[]> =>
    api.get('/tsje/resultados', {
      params: { cod_eleccion: PLRA_2026, cod_dpto: codDpto, cod_distrito: codDistrito },
    }).then(r => {
      // El backend devuelve { codEleccion, codDpto, codDistrito, cargos: [...] }
      const body = r.data;
      if (Array.isArray(body)) return body;
      if (body && Array.isArray(body.cargos)) return body.cargos;
      return [];
    }),

  getSyncStatus: (codDpto: number, codDistrito: number): Promise<{ lastSync: string | null; inFlight: boolean; lastError: string | null }> =>
    api.get('/tsje/sync/status', {
      params: { cod_eleccion: PLRA_2026, cod_dpto: codDpto, cod_distrito: codDistrito },
    }).then(r => r.data),

  // Dispara sync en background — el server responde 202 de inmediato.
  // Usar pollUntilDone() para saber cuando terminó.
  triggerSync: (codDpto: number, codDistrito: number): Promise<void> =>
    api.post('/tsje/sync', { cod_eleccion: PLRA_2026, cod_dpto: codDpto, cod_distrito: codDistrito }, { timeout: 10000 }).then(() => {}),

  // Polling: resuelve cuando inFlight pasa a false o se detecta error.
  pollUntilDone: (codDpto: number, codDistrito: number, intervalMs = 3000, maxWaitMs = 300000): Promise<{ error: string | null }> => {
    const deadline = Date.now() + maxWaitMs;
    return new Promise((resolve) => {
      const check = async () => {
        try {
          const status = await tsjeApi.getSyncStatus(codDpto, codDistrito);
          if (!status.inFlight) {
            resolve({ error: status.lastError ?? null });
            return;
          }
        } catch { /* ignore poll errors, keep waiting */ }
        if (Date.now() >= deadline) {
          resolve({ error: 'Tiempo de espera agotado.' });
          return;
        }
        setTimeout(check, intervalMs);
      };
      setTimeout(check, intervalMs);
    });
  },

  getScenarios: (): Promise<TsjeScenario[]> =>
    api.get('/tsje/scenarios', { params: { cod_eleccion: PLRA_2026 } }).then(r => r.data),

  createScenario: (data: { nombre: string; descripcion?: string; seats: Record<string, number> }): Promise<TsjeScenario> =>
    api.post('/tsje/scenarios', { ...data, cod_eleccion: PLRA_2026 }).then(r => r.data),

  updateScenario: (id: number, data: { nombre?: string; descripcion?: string; seats?: Record<string, number> }): Promise<TsjeScenario> =>
    api.put(`/tsje/scenarios/${id}`, data).then(r => r.data),

  deleteScenario: (id: number): Promise<void> =>
    api.delete(`/tsje/scenarios/${id}`).then(() => {}),
};
