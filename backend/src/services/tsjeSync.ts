import axios from 'axios';
import db from '../db';
import { getParaguayTimestamp } from '../utils/timezone';

const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const DIVULGACION_ENDPOINT = `${TSJE_BASE}/dinamics/divulgacion.ajax.php`;
const CERTIFICADO_ENDPOINT = `${TSJE_BASE}/dinamics/certificado.ajax.php`;
const CATALOG_URL = (name: string) => `${TSJE_BASE}/statics/json/certificado/${name}.json`;

type CargoDef = { cod: number; des: string; tip: number; niv: number; via: 'divulgacion' | 'mesa' };

// Cargos PLRA 2026.
//   via='divulgacion' → API consolidada (rápido, 1 call por cargo, trae candidatosPref)
//   via='mesa'        → iterar certificado.ajax.php mesa por mesa y agregar nosotros (sin preferentes)
// El TSJE solo expone via 'divulgacion' los 8 primeros. Los 4 últimos (6, 7, 11, 12)
// no están en divulgacion.ajax.php y solo se acceden por mesa individual.
const PLRA_2026_CARGOS: CargoDef[] = [
  { cod: 1,  des: 'INTENDENTE MUNICIPAL',                  tip: 1, niv: 2, via: 'divulgacion' },
  { cod: 2,  des: 'JUNTA MUNICIPAL',                       tip: 2, niv: 2, via: 'divulgacion' },
  { cod: 3,  des: 'PRESIDENTE - VICE 1° Y VICE 2° - PLRA', tip: 1, niv: 0, via: 'divulgacion' },
  { cod: 4,  des: 'DIRECTORIO NACIONAL',                   tip: 2, niv: 0, via: 'divulgacion' },
  { cod: 5,  des: 'DIRECTORIO DEPARTAMENTAL',              tip: 2, niv: 1, via: 'divulgacion' },
  { cod: 6,  des: 'COMITE LOCAL',                          tip: 2, niv: 2, via: 'mesa' },
  { cod: 7,  des: 'CONVENCIONAL',                          tip: 2, niv: 2, via: 'mesa' },
  { cod: 8,  des: 'PRESIDENTE - VICE 1° Y VICE 2° - JLRA', tip: 1, niv: 0, via: 'divulgacion' },
  { cod: 9,  des: 'CONDUCCION NAC. JLRA',                  tip: 2, niv: 0, via: 'divulgacion' },
  { cod: 10, des: 'REPRESENTANTE DEPARTAMENTAL - JLRA',    tip: 2, niv: 1, via: 'divulgacion' },
  { cod: 11, des: 'BANCAS FILIALES',                       tip: 2, niv: 2, via: 'mesa' },
  { cod: 12, des: 'MIEMBRO CONVENCIONAL - JLRA',           tip: 2, niv: 2, via: 'mesa' },
];

type DivulgacionResponse = {
  totales: {
    totalMesas: number;
    mesasPublicadas: number;
    blancos: number;
    nulos: number;
    totalVotos: number;
    canElectores: number;
    canElectoresPublicados: number;
    nocomputados: number;
    tipCandidatura: number;
  };
  candidatos: Array<{
    orden: number;
    numLista: string;
    nomCandidato: string;
    desPartido: string;
    sigPartido?: string;
    colLista?: string;
    imgCandidato?: string;
    votos: number;
    candidatosPref?: Array<{
      orden: number;
      numLista: string;
      nomCandidato: string;
      desPartido: string;
      votos: number;
      ordCandidato: number;
    }>;
  }>;
  hora?: string;
  horaFormated?: string;
};

const http = axios.create({
  timeout: 20000,
  headers: { 'User-Agent': 'Intelecciones-TREP-Sync/1.0' },
  validateStatus: () => true,
});

async function fetchWithRetry(url: string, params: Record<string, any>, maxAttempts = 3): Promise<DivulgacionResponse | null> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await http.get(url, { params });
      if (res.status >= 200 && res.status < 300) {
        const body = res.data;
        if (typeof body === 'string' && body.trim().length === 0) return null;
        if (typeof body === 'object' && body !== null) return body as DivulgacionResponse;
        return null;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, 500 * attempt));
  }
  throw lastErr ?? new Error('Unknown fetch error');
}

function upsertCargo(codEleccion: number, c: { cod: number; des: string; tip: number; niv: number }) {
  db.prepare(`
    INSERT INTO tsje_cargos (cod_eleccion, cod_cargo, des_cargo, tip_cargo, niv_cargo)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cod_eleccion, cod_cargo) DO UPDATE SET
      des_cargo = excluded.des_cargo,
      tip_cargo = excluded.tip_cargo,
      niv_cargo = excluded.niv_cargo
  `).run(codEleccion, c.cod, c.des, c.tip, c.niv);
}

function persistResult(
  codEleccion: number,
  codCargo: number,
  codDpto: number,
  codDistrito: number,
  data: DivulgacionResponse,
) {
  const now = getParaguayTimestamp();
  const t = data.totales;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO tsje_resultado_distrito (
        cod_eleccion, cod_cargo, cod_dpto, cod_distrito,
        des_dpto, des_distrito,
        blancos, nulos, total_votos, electores, electores_publ,
        mesas_publicadas, total_mesas, no_computados,
        hora_tsje, fetched_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cod_eleccion, cod_cargo, cod_dpto, cod_distrito) DO UPDATE SET
        blancos          = excluded.blancos,
        nulos            = excluded.nulos,
        total_votos      = excluded.total_votos,
        electores        = excluded.electores,
        electores_publ   = excluded.electores_publ,
        mesas_publicadas = excluded.mesas_publicadas,
        total_mesas      = excluded.total_mesas,
        no_computados    = excluded.no_computados,
        hora_tsje        = excluded.hora_tsje,
        fetched_at       = excluded.fetched_at
    `).run(
      codEleccion, codCargo, codDpto, codDistrito,
      t.blancos ?? 0, t.nulos ?? 0, t.totalVotos ?? 0,
      t.canElectores ?? 0, t.canElectoresPublicados ?? 0,
      t.mesasPublicadas ?? 0, t.totalMesas ?? 0, t.nocomputados ?? 0,
      data.horaFormated ?? data.hora ?? null, now,
    );

    db.prepare(`
      DELETE FROM tsje_resultado_lista
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito = ?
    `).run(codEleccion, codCargo, codDpto, codDistrito);

    db.prepare(`
      DELETE FROM tsje_resultado_preferente
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito = ?
    `).run(codEleccion, codCargo, codDpto, codDistrito);

    const insertLista = db.prepare(`
      INSERT INTO tsje_resultado_lista (
        cod_eleccion, cod_cargo, cod_dpto, cod_distrito,
        num_lista, orden, des_partido, sig_partido, col_lista, img_lista, votos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPref = db.prepare(`
      INSERT INTO tsje_resultado_preferente (
        cod_eleccion, cod_cargo, cod_dpto, cod_distrito,
        num_lista, ord_candidato, nom_candidato, des_partido, orden, votos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cod_eleccion, cod_cargo, cod_dpto, cod_distrito, num_lista, ord_candidato) DO UPDATE SET
        nom_candidato = excluded.nom_candidato,
        des_partido   = excluded.des_partido,
        orden         = excluded.orden,
        votos         = excluded.votos
    `);

    for (const cand of data.candidatos ?? []) {
      insertLista.run(
        codEleccion, codCargo, codDpto, codDistrito,
        cand.numLista, cand.orden ?? null,
        cand.desPartido ?? null, cand.sigPartido ?? null,
        cand.colLista ?? null, cand.imgCandidato ?? null,
        cand.votos ?? 0,
      );

      for (const pref of cand.candidatosPref ?? []) {
        insertPref.run(
          codEleccion, codCargo, codDpto, codDistrito,
          pref.numLista, pref.ordCandidato,
          pref.nomCandidato ?? null, pref.desPartido ?? null,
          pref.orden ?? null, pref.votos ?? 0,
        );
      }
    }
  });

  tx();
}

export type SyncResult = {
  syncLogId: number;
  startedAt: string;
  finishedAt: string;
  cargosOk: number;
  cargosErr: number;
  details: Array<{ cargo: number; via: 'divulgacion' | 'mesa'; status: 'ok' | 'empty' | 'error'; mesasOk?: number; mesasTotal?: number; error?: string }>;
};

// ── CATALOG FETCH (parse "var jsonX = {...};" JS files) ──
async function fetchTsjeCatalog<T = any>(name: string): Promise<T> {
  const res = await http.get(CATALOG_URL(name), { transformResponse: r => r });
  const text = String(res.data ?? '');
  const cleaned = text.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(cleaned) as T;
}

// Estructura: jsonSeguridad[eleccion][dpto][distrito][zona][local][mesa][cargo] = codigo
type SeguridadCatalog = Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, number>>>>>>>;

// Persistencia del agregado por mesa: usa las mismas tablas que persistResult
// pero sin candidatosPref (el endpoint por mesa no los expone).
function persistAggregate(
  codEleccion: number,
  codCargo: number,
  codDpto: number,
  codDistrito: number,
  agg: {
    blancos: number; nulos: number; totalVotos: number; nocomputados: number;
    mesasPublicadas: number; totalMesas: number;
    listas: Map<string, { numLista: string; orden: number | null; desPartido: string | null; sigPartido: string | null; votos: number }>;
  },
) {
  const now = getParaguayTimestamp();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO tsje_resultado_distrito (
        cod_eleccion, cod_cargo, cod_dpto, cod_distrito,
        des_dpto, des_distrito,
        blancos, nulos, total_votos, electores, electores_publ,
        mesas_publicadas, total_mesas, no_computados,
        hora_tsje, fetched_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 0, 0, ?, ?, ?, NULL, ?)
      ON CONFLICT(cod_eleccion, cod_cargo, cod_dpto, cod_distrito) DO UPDATE SET
        blancos          = excluded.blancos,
        nulos            = excluded.nulos,
        total_votos      = excluded.total_votos,
        mesas_publicadas = excluded.mesas_publicadas,
        total_mesas      = excluded.total_mesas,
        no_computados    = excluded.no_computados,
        fetched_at       = excluded.fetched_at
    `).run(
      codEleccion, codCargo, codDpto, codDistrito,
      agg.blancos, agg.nulos, agg.totalVotos,
      agg.mesasPublicadas, agg.totalMesas, agg.nocomputados, now,
    );

    db.prepare(`
      DELETE FROM tsje_resultado_lista
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito = ?
    `).run(codEleccion, codCargo, codDpto, codDistrito);

    // Limpio también preferentes para el caso de "ya había via=divulgacion antes"
    db.prepare(`
      DELETE FROM tsje_resultado_preferente
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito = ?
    `).run(codEleccion, codCargo, codDpto, codDistrito);

    const insertLista = db.prepare(`
      INSERT INTO tsje_resultado_lista (
        cod_eleccion, cod_cargo, cod_dpto, cod_distrito,
        num_lista, orden, des_partido, sig_partido, col_lista, img_lista, votos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
    `);
    for (const l of agg.listas.values()) {
      insertLista.run(
        codEleccion, codCargo, codDpto, codDistrito,
        l.numLista, l.orden, l.desPartido, l.sigPartido, l.votos,
      );
    }
  });
  tx();
}

async function aggregateCargoByMesa(
  codEleccion: number,
  codDpto: number,
  codDistrito: number,
  cargo: CargoDef,
  seguridad: SeguridadCatalog,
  rateLimitMs: number,
): Promise<{ mesasOk: number; mesasTotal: number }> {
  const distrito = seguridad?.[String(codEleccion)]?.[String(codDpto)]?.[String(codDistrito)];
  if (!distrito) return { mesasOk: 0, mesasTotal: 0 };

  const agg = {
    blancos: 0, nulos: 0, totalVotos: 0, nocomputados: 0,
    mesasPublicadas: 0, totalMesas: 0,
    listas: new Map<string, { numLista: string; orden: number | null; desPartido: string | null; sigPartido: string | null; votos: number }>(),
  };

  for (const zona of Object.keys(distrito)) {
    for (const local of Object.keys(distrito[zona])) {
      for (const mesa of Object.keys(distrito[zona][local])) {
        const codigosByCargo = distrito[zona][local][mesa];
        const codigo = codigosByCargo?.[String(cargo.cod)];
        if (codigo === undefined) continue; // esta mesa no tiene este cargo

        agg.totalMesas++;

        try {
          const res = await http.get(CERTIFICADO_ENDPOINT, {
            params: {
              eleccion: codEleccion, candidatura: cargo.cod,
              departamento: codDpto, distrito: codDistrito,
              zona, local, mesa, codigo,
            },
          });
          if (res.status < 200 || res.status >= 300) continue;
          const data: any = res.data;
          if (!data?.cabecera) continue;

          agg.mesasPublicadas++;
          agg.blancos       += data.cabecera.blancos ?? 0;
          agg.nulos         += data.cabecera.nulos ?? 0;
          agg.totalVotos    += data.cabecera.totProg ?? 0;
          agg.nocomputados  += data.cabecera.nocomputados ?? 0;

          for (const det of data.detalle ?? []) {
            const key = String(det.numLista);
            const existing = agg.listas.get(key);
            if (existing) {
              existing.votos += det.votos ?? 0;
            } else {
              agg.listas.set(key, {
                numLista: key,
                orden: det.orden ?? null,
                desPartido: det.desPartido ?? null,
                sigPartido: det.sigPartido ?? null,
                votos: det.votos ?? 0,
              });
            }
          }
        } catch {
          // skip mesa con error puntual; el agregado igual continúa
        }

        if (rateLimitMs > 0) await new Promise(r => setTimeout(r, rateLimitMs));
      }
    }
  }

  persistAggregate(codEleccion, cargo.cod, codDpto, codDistrito, agg);
  return { mesasOk: agg.mesasPublicadas, mesasTotal: agg.totalMesas };
}

export async function syncDistrito(
  codEleccion: number,
  codDpto: number,
  codDistrito: number,
  opts: { rateLimitMs?: number } = {},
): Promise<SyncResult> {
  const rateLimitMs = opts.rateLimitMs ?? 250;
  const startedAt = getParaguayTimestamp();

  const logInsert = db.prepare(`
    INSERT INTO tsje_sync_log (cod_eleccion, cod_dpto, cod_distrito, started_at, status)
    VALUES (?, ?, ?, ?, 'RUNNING')
  `).run(codEleccion, codDpto, codDistrito, startedAt);
  const syncLogId = Number(logInsert.lastInsertRowid);

  const details: SyncResult['details'] = [];
  let cargosOk = 0;
  let cargosErr = 0;

  // Catálogo de seguridad cacheado para todos los cargos via='mesa' de esta corrida.
  // Solo se descarga si hay al menos un cargo que lo necesita.
  let seguridad: SeguridadCatalog | null = null;
  const needsCatalog = PLRA_2026_CARGOS.some(c => c.via === 'mesa');

  for (const cargo of PLRA_2026_CARGOS) {
    upsertCargo(codEleccion, cargo);

    if (cargo.via === 'divulgacion') {
      try {
        // El nivel del cargo decide hasta dónde se filtra geográficamente:
        //   niv 0 (nacional)        → sin dpto ni distrito
        //   niv 1 (departamental)   → solo dpto
        //   niv 2 (distrital/local) → dpto + distrito
        // 1. Fetch the official consolidated level
        const params: Record<string, any> = { codeleccion: codEleccion, candidatura: cargo.cod };
        if (cargo.niv >= 1) params.departamento = codDpto;
        
        const data = await fetchWithRetry(DIVULGACION_ENDPOINT, params);
        if (data) {
          const storeDpto     = cargo.niv >= 1 ? codDpto     : 0;
          const storeDistrito = cargo.niv === 1 ? -1 : 0; // -1 represents departmental consolidation
          persistResult(codEleccion, cargo.cod, storeDpto, storeDistrito, data);
        }

        // 2. For national/departamental cargos, aggregate mesa-by-mesa to get district-level results
        if (cargo.niv < 2) {
          if (seguridad === null) {
            seguridad = await fetchTsjeCatalog<SeguridadCatalog>('seguridad');
          }
          if (seguridad) {
            await aggregateCargoByMesa(
              codEleccion, codDpto, codDistrito, cargo, seguridad, rateLimitMs
            );
          }
        }

        cargosOk++;
        details.push({ cargo: cargo.cod, via: 'divulgacion', status: 'ok' });
      } catch (e: any) {
        cargosErr++;
        details.push({ cargo: cargo.cod, via: 'divulgacion', status: 'error', error: e?.message ?? String(e) });
      }
    } else {
      // via === 'mesa': itera certificado.ajax.php por cada mesa y agrega
      try {
        if (seguridad === null) {
          seguridad = await fetchTsjeCatalog<SeguridadCatalog>('seguridad');
        }
        if (!seguridad) {
          details.push({ cargo: cargo.cod, via: 'mesa', status: 'error', error: 'No se pudo cargar seguridad.json' });
          cargosErr++;
          continue;
        }
        const { mesasOk, mesasTotal } = await aggregateCargoByMesa(
          codEleccion, codDpto, codDistrito, cargo, seguridad, rateLimitMs,
        );
        if (mesasTotal === 0) {
          details.push({ cargo: cargo.cod, via: 'mesa', status: 'empty', mesasOk, mesasTotal });
        } else {
          cargosOk++;
          details.push({ cargo: cargo.cod, via: 'mesa', status: 'ok', mesasOk, mesasTotal });
        }
      } catch (e: any) {
        cargosErr++;
        details.push({ cargo: cargo.cod, via: 'mesa', status: 'error', error: e?.message ?? String(e) });
      }
    }
  }

  const finishedAt = getParaguayTimestamp();
  const status = cargosErr > 0 ? (cargosOk > 0 ? 'PARTIAL' : 'FAILED') : 'OK';

  db.prepare(`
    UPDATE tsje_sync_log
    SET finished_at = ?, status = ?, cargos_ok = ?, cargos_err = ?
    WHERE id = ?
  `).run(finishedAt, status, cargosOk, cargosErr, syncLogId);

  return { syncLogId, startedAt, finishedAt, cargosOk, cargosErr, details };
}

export function listCargos(codEleccion: number) {
  return db.prepare(`
    SELECT cod_cargo, des_cargo, tip_cargo, niv_cargo
    FROM tsje_cargos
    WHERE cod_eleccion = ?
    ORDER BY cod_cargo
  `).all(codEleccion);
}

export function getResultados(codEleccion: number, codDpto: number, codDistrito: number) {
  const totales = db.prepare(`
    SELECT t.cod_cargo, t.cod_dpto, t.cod_distrito, c.des_cargo, c.tip_cargo, c.niv_cargo,
           t.blancos, t.nulos, t.total_votos, t.electores, t.electores_publ,
           t.mesas_publicadas, t.total_mesas, t.no_computados,
           t.hora_tsje, t.fetched_at
    FROM tsje_resultado_distrito t
    JOIN tsje_cargos c ON c.cod_eleccion = t.cod_eleccion AND c.cod_cargo = t.cod_cargo
    WHERE t.cod_eleccion = ?
      AND (
        (t.cod_dpto = 0 AND t.cod_distrito = 0)
        OR (t.cod_dpto = ? AND t.cod_distrito = -1) -- Departmental consolidation
        OR (t.cod_dpto = ? AND t.cod_distrito = ?)   -- Active District
      )
    ORDER BY t.cod_cargo, t.cod_dpto, t.cod_distrito
  `).all(codEleccion, codDpto, codDpto, codDistrito) as any[];

  const cargos = totales.map((t: any) => {
    const listas = db.prepare(`
      SELECT num_lista, orden, des_partido, sig_partido, col_lista, votos
      FROM tsje_resultado_lista
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito = ?
      ORDER BY votos DESC
    `).all(codEleccion, t.cod_cargo, t.cod_dpto, t.cod_distrito);

    const preferentes = db.prepare(`
      SELECT num_lista, ord_candidato, nom_candidato, des_partido, orden, votos
      FROM tsje_resultado_preferente
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito = ?
      ORDER BY votos DESC
    `).all(codEleccion, t.cod_cargo, t.cod_dpto, t.cod_distrito);

    return { ...t, listas, preferentes };
  });

  // Dynamically calculate departmental scope for national cargos (niv_cargo === 0)
  const nationalCargos = cargos.filter(c => c.niv_cargo === 0);
  const uniqueNationalCargos = Array.from(new Set(nationalCargos.map(c => c.cod_cargo)));

  for (const codCargo of uniqueNationalCargos) {
    if (cargos.some(c => c.cod_cargo === codCargo && c.cod_dpto === codDpto && c.cod_distrito === -1)) {
      continue;
    }

    const districts = db.prepare(`
      SELECT blancos, nulos, total_votos, electores, electores_publ,
             mesas_publicadas, total_mesas, no_computados, hora_tsje, fetched_at
      FROM tsje_resultado_distrito
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito >= 0
    `).all(codEleccion, codCargo, codDpto) as any[];

    if (districts.length === 0) continue;

    const baseCargo = nationalCargos.find(c => c.cod_cargo === codCargo)!;
    const aggTotal = {
      cod_cargo: codCargo,
      cod_dpto: codDpto,
      cod_distrito: -1,
      des_cargo: baseCargo.des_cargo,
      tip_cargo: baseCargo.tip_cargo,
      niv_cargo: baseCargo.niv_cargo,
      blancos: 0,
      nulos: 0,
      total_votos: 0,
      electores: 0,
      electores_publ: 0,
      mesas_publicadas: 0,
      total_mesas: 0,
      no_computados: 0,
      hora_tsje: districts[0].hora_tsje,
      fetched_at: districts[0].fetched_at,
    };

    for (const d of districts) {
      aggTotal.blancos += d.blancos;
      aggTotal.nulos += d.nulos;
      aggTotal.total_votos += d.total_votos;
      aggTotal.electores += d.electores;
      aggTotal.electores_publ += d.electores_publ;
      aggTotal.mesas_publicadas += d.mesas_publicadas;
      aggTotal.total_mesas += d.total_mesas;
      aggTotal.no_computados += d.no_computados;
      if (d.fetched_at > aggTotal.fetched_at) {
        aggTotal.fetched_at = d.fetched_at;
        aggTotal.hora_tsje = d.hora_tsje;
      }
    }

    const listsRows = db.prepare(`
      SELECT num_lista, orden, des_partido, sig_partido, col_lista, SUM(votos) as total_votos
      FROM tsje_resultado_lista
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito >= 0
      GROUP BY num_lista
      ORDER BY total_votos DESC
    `).all(codEleccion, codCargo, codDpto) as any[];

    const listas = listsRows.map(r => ({
      num_lista: r.num_lista,
      orden: r.orden,
      des_partido: r.des_partido,
      sig_partido: r.sig_partido,
      col_lista: r.col_lista,
      votos: r.total_votos,
    }));

    const prefRows = db.prepare(`
      SELECT num_lista, ord_candidato, nom_candidato, des_partido, orden, SUM(votos) as total_votos
      FROM tsje_resultado_preferente
      WHERE cod_eleccion = ? AND cod_cargo = ? AND cod_dpto = ? AND cod_distrito >= 0
      GROUP BY num_lista, ord_candidato
      ORDER BY total_votos DESC
    `).all(codEleccion, codCargo, codDpto) as any[];

    const preferentes = prefRows.map(r => ({
      num_lista: r.num_lista,
      ord_candidato: r.ord_candidato,
      nom_candidato: r.nom_candidato,
      des_partido: r.des_partido,
      orden: r.orden,
      votos: r.total_votos,
    }));

    cargos.push({
      ...aggTotal,
      listas,
      preferentes,
    });
  }

  // Ensure they remain sorted properly
  cargos.sort((a, b) => {
    if (a.cod_cargo !== b.cod_cargo) return a.cod_cargo - b.cod_cargo;
    if (a.cod_dpto !== b.cod_dpto) return a.cod_dpto - b.cod_dpto;
    return a.cod_distrito - b.cod_distrito;
  });

  return { codEleccion, codDpto, codDistrito, cargos };
}

export function getLastSync(codEleccion: number, codDpto: number, codDistrito: number) {
  return db.prepare(`
    SELECT id, started_at, finished_at, status, cargos_ok, cargos_err, error_msg
    FROM tsje_sync_log
    WHERE cod_eleccion = ? AND cod_dpto = ? AND cod_distrito = ?
    ORDER BY started_at DESC
    LIMIT 1
  `).get(codEleccion, codDpto, codDistrito);
}

export const TSJE_PLRA_CARGOS = PLRA_2026_CARGOS;
