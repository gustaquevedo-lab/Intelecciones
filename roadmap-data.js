// ROADMAP DATA — Intelecciones Optimization Plan
const ROADMAP = [
  {
    id: "fase-0", phase: 0,
    title: "Quick Wins — Respiraci\u00f3n Artificial",
    weeks: "Semana 1-2",
    objective: "Resultados inmediatos en timeouts, estabilidad y errores visibles. Estos cambios se pueden hacer sin riesgo y dan el mayor impacto por hora invertida.",
    groups: [
      {
        id: "0.1", name: "axios-retry + timeouts inteligentes", effort: "1 d\u00eda",
        description: "Hoy el frontend no reintenta requests fallidos. Si la API tarda >30s, el usuario ve un error gen\u00e9rico despu\u00e9s de media espera. Agregar retry con exponential backoff y timeouts por tipo de endpoint.",
        dependencies: [],
        prompt: "Tarea: Implementar retry autom\u00e1tico con exponential backoff en el interceptor de axios.\n\n1. Instalar axios-retry@4\n2. Configurar axiosRetry(api, { retries: 3, retryDelay: axiosRetry.exponentialDelay })\n3. Solo reintentar en: timeout (ECONNABORTED), network error, 5xx. NO en 4xx ni 429.\n4. Timeouts: reportes 120s, offline padron 300s, general 30s, login/writes 15s\n5. Logging en DEV, silencioso en PROD\n6. Orden: interceptor 401 primero, retry despu\u00e9s, build-version al final\n7. Archivo: frontend/src/services/api.ts",
        tasks: ["Instalar axios-retry@4","Configurar retry interceptor con exponential backoff (3 retries, solo timeout/network/5xx)","Agregar timeouts espec\u00edficos por tipo de endpoint","Verificar orden de interceptors: 401 primero, retry despu\u00e9s, build-version al final"]
      },
      {
        id: "0.2", name: "Eliminar \u00edndices duplicados en SQLite", effort: "Medio d\u00eda",
        description: "La DB tiene 14 pares de \u00edndices duplicados. Cada INSERT/UPDATE escribe en 28 \u00edndices al pedo, duplicando trabajo.",
        dependencies: [],
        prompt: "Tarea: Eliminar \u00edndices duplicados en db.ts y limpiar DB.\n\nArchivos: backend/src/db.ts, crear backend/scripts/drop-duplicate-indexes.ts\n\nDuplicados a eliminar en db.ts: idx_users_list (L428), idx_users_campaign (L429), idx_users_parent (L425), idx_users_ci (L426), idx_electors_distrito (L422), idx_electors_ciudad (L422), idx_elector_captures_coord, idx_elector_captures_list, idx_elector_captures_ci, idx_captures_coord_agg, idx_audit_logs_user (L441).\n\nScript one-shot: DROP INDEX IF EXISTS para cada duplicado.",
        tasks: ["Identificar y eliminar CREATE INDEX duplicados en db.ts (14 pares)","Crear script backend/scripts/drop-duplicate-indexes.ts","Ejecutar script one-shot contra DB de producci\u00f3n","Verificar con EXPLAIN QUERY PLAN que \u00edndices correctos se usan"]
      },
      {
        id: "0.3", name: "Paginaci\u00f3n en queries sin WHERE/LIMIT", effort: "1 d\u00eda",
        description: "Varios endpoints devuelven TODAS las filas: offline/padron (500K+ electores), audit/export, captures, activities.",
        dependencies: [],
        prompt: "Tarea: Agregar paginaci\u00f3n obligatoria a endpoints sin l\u00edmite.\n\nArchivo: backend/src/server.ts\n\n1. GET /api/offline/padron: limit=10000 sin distrito, default 5000\n2. GET /api/captures: ?page=1&perPage=50 (max 200), incluir total count\n3. GET /api/activities: ?limit=50 (max 200)\n4. GET /api/admin/electors/search: LIMIT 100 forzado\n5. GET /api/audit/export: paginaci\u00f3n obligatoria, error 400 sin page\n6. Revisar todos los SELECT * FROM sin WHERE y agregar LIMIT 1000",
        tasks: ["Paginaci\u00f3n a GET /api/offline/padron","Paginaci\u00f3n a GET /api/captures","Paginaci\u00f3n a GET /api/activities","LIMIT 100 forzado a GET /api/admin/electors/search","Paginaci\u00f3n obligatoria a GET /api/audit/export"]
      },
      {
        id: "0.4", name: "\u00cdndices faltantes para queries pesadas", effort: "1 d\u00eda",
        description: "Faltan \u00edndices compuestos: elector_captures(campaign_id, list_id, is_disputed), capture_conflicts(status, elector_ci), etc.",
        dependencies: [],
        prompt: "Tarea: Agregar \u00edndices compuestos faltantes en db.ts.\n\nArchivo: backend/src/db.ts\n\n\u00cdndices:\n1. idx_captures_campaign_list_disputed ON elector_captures(campaign_id, list_id, is_disputed)\n2. idx_captures_coord_timestamp ON elector_captures(coordinator_id, timestamp DESC)\n3. idx_conflicts_status_ci ON capture_conflicts(status, elector_ci)\n4. idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC)\n5. idx_users_role_distrito_parent ON users(role, distrito, parent_id)\n6. idx_electors_ciudad_distrito ON electors(ciudad, distrito)",
        tasks: ["idx_captures_campaign_list_disputed","idx_captures_coord_timestamp","idx_conflicts_status_ci","idx_audit_logs_user_timestamp","idx_users_role_distrito_parent","idx_electors_ciudad_distrito"]
      },
      {
        id: "0.5", name: "Cach\u00e9 de reportes pesados", effort: "2 d\u00edas",
        description: "Reportes que computan los mismos resultados cada vez. Cach\u00e9 en memoria de 30-60s evita recalcular.",
        dependencies: [],
        prompt: "Tarea: Capa de cach\u00e9 en memoria para reportes pesados.\n\nArchivo: backend/src/server.ts\n\nHelper createCache<T>(ttl) con get/set/invalidate.\n\nEndpoints:\n1. GET /structure/padrinos/:id/full-report: TTL 60s\n2. GET /my-team/reports: TTL 30s\n3. GET /stats/command: TTL 15s\n4. GET /diad/coverage: TTL 30s\n\nInvalidar al crear capture, usuario, sync locations.\nCleanup peri\u00f3dico de expirados cada 5 min.",
        tasks: ["Crear helper createCache<T>(ttl)","Cachear full-report TTL 60s","Cachear my-team TTL 30s","Cachear stats/command TTL 15s","Cachear diad/coverage TTL 30s","Implementar invalidaci\u00f3n","Cleanup peri\u00f3dico cada 5 min"]
      },
      {
        id: "0.6", name: "Eliminar console.log en producci\u00f3n", effort: "Medio d\u00eda",
        description: "console.log en producci\u00f3n en syncService, offlineDb, api.ts, AuthContext. En Node.js bloquea el event loop.",
        dependencies: [],
        prompt: "Tarea: Condicionar console.log a DEV.\n\nFrontend: crear utils/debug.ts con debug = import.meta.env.DEV ? console.log : ()=>{}\nReemplazar console.log en: syncService.ts, offlineDb.ts, api.ts, AuthContext.tsx, p\u00e1ginas\nconsole.error siempre, console.warn condicionado.\n\nBackend: crear utils/logger.ts con logger.info/warn/error/debug condicionado a NODE_ENV.\nReemplazar console.log en server.ts.",
        tasks: ["Crear frontend/src/utils/debug.ts","Reemplazar console.log en syncService, offlineDb, api, AuthContext","Reemplazar console.log en p\u00e1ginas","Crear backend/src/utils/logger.ts","Reemplazar console.log en server.ts"]
      }
    ]
  },
  {
    id: "fase-1", phase: 1,
    title: "Backend \u2014 Matar los Cuellos de Botella",
    weeks: "Semana 3-5",
    objective: "Reducir dr\u00e1sticamente el tiempo de respuesta de las APIs eliminando N+1 queries, subqueries correlacionadas y CROSS JOINs.",
    groups: [
      {
        id: "1.1", name: "Reemplazar subqueries correlacionadas por CTEs", effort: "3 d\u00edas",
        description: "/api/padrino/team-stats y /api/my-team tienen HASTA 10 subqueries correlacionadas por fila. Cada fila ejecuta 10 SELECTs adicionales.",
        dependencies: [],
        prompt: "Tarea: Reemplazar subqueries correlacionadas por CTEs.\n\nArchivo: backend/src/server.ts\n\nPatr\u00f3n actual (por fila):\n  (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) as total\n\nPatr\u00f3n CTE:\n  WITH capture_stats AS (SELECT coordinator_id, COUNT(*) as total, SUM(CASE WHEN traffic_light='GREEN' THEN 1 ELSE 0 END) as green, ... FROM elector_captures GROUP BY coordinator_id)\n  SELECT u.*, COALESCE(cs.total,0) FROM users u LEFT JOIN capture_stats cs ON cs.coordinator_id = u.id\n\nRefactorizar: L3889 (6 subqueries), L3941 (10 subqueries), L4301 (6 subqueries).",
        tasks: ["Refactor /api/padrino/team-stats (6 subqueries a CTE)","Refactor /api/my-team padrino query (10 subqueries a CTE)","Refactor /api/my-team admin query (6 subqueries a CTE)","Verificar resultados id\u00e9nticos"]
      },
      {
        id: "1.2", name: "Eliminar CROSS JOIN en admin/conflicts y admin/activity", effort: "2 d\u00edas",
        description: "/api/admin/conflicts: CROSS JOIN con electors (500K) + 9 LEFT JOINs. /api/admin/activity: 3 CROSS JOINs con UNION ALL.",
        dependencies: [],
        prompt: "Tarea: Eliminar CROSS JOINs.\n\nArchivo: backend/src/server.ts\n\n1. /api/admin/conflicts (L2968): CROSS JOIN electors e por INNER JOIN (SELECT ci FROM electors WHERE ci IN (SELECT elector_ci FROM capture_conflicts WHERE status!='RESOLVED')) e\n\n2. /api/admin/activity (L4211): 3 CROSS JOINs a INNER JOIN con condiciones expl\u00edcitas + LIMIT en subqueries antes del UNION.",
        tasks: ["Refactor admin/conflicts: CROSS JOIN a INNER JOIN","Refactor admin/activity: 3 CROSS JOINs a INNER JOIN","Verificar resultados equivalentes"]
      },
      {
        id: "1.3", name: "Refactor /api/my-team/reports", effort: "3 d\u00edas",
        description: "Endpoint m\u00e1s pesado (~400 l\u00edneas, timeout 90s en frontend). 4+ getSecurityFilter, l\u00f3gica duplicada, N+1 patterns.",
        dependencies: ["1.1"],
        prompt: "Tarea: Refactorizar /api/my-team/reports (L4319-4732).\n\nArchivo: backend/src/server.ts\n\n1. Extraer getPadrinoStats() y getCoordinatorStats() con CTEs\n2. Un solo getSecurityFilter por request (no 4+)\n3. CTE \u00fanica para cada bloque (padrino, admin, coordinador)\n4. Paginaci\u00f3n default con max 100\n5. Refactor flujo de roles con switch al inicio\n6. Objetivo: <2s para cualquier caso",
        tasks: ["Extraer getPadrinoStats/getCoordinatorStats con CTEs","Simplificar getSecurityFilter a 1 llamada","CTE \u00fanica para cada bloque","Paginaci\u00f3n default max 100","Refactor flujo con switch","Verificar <2s en todos los casos"]
      },
      {
        id: "1.4", name: "Refactor /api/diad/coverage", effort: "2 d\u00edas",
        description: "Segundo endpoint m\u00e1s pesado. 7 queries secuenciales incluyendo triple subquery GROUP BY anidada sobre electors.",
        dependencies: [],
        prompt: "Tarea: Reducir /api/diad/coverage (L5719-5814) de 7 queries a m\u00e1ximo 3.\n\nArchivo: backend/src/server.ts\n\nCombinar queries 1,3,4 en UNA:\nSELECT e.local_votacion, e.mesa, COUNT(DISTINCT e.ci) as electores, COUNT(DISTINCT r.id) as tiene_resultado, COUNT(DISTINCT u.id) as tiene_veedor\nFROM electors e LEFT JOIN results r ON ... LEFT JOIN users u ON ...\nWHERE [distritoFilter] GROUP BY e.local_votacion, e.mesa\n\nCombinar queries 5,6 con UNION ALL.\nMantener query 2 separada.\nObjetivo: <500ms desde >5s.",
        tasks: ["Combinar queries de mesas (1,3,4) en UNA","Combinar queries 5,6 con UNION ALL","Mantener estructura de response id\u00e9ntica","Verificar resultados equivalentes","Objetivo: <500ms"]
      },
      {
        id: "1.5", name: "Refactor /api/stats/command", effort: "2 d\u00edas",
        description: "7+ queries donde 4-5 tienen el MISMO 5-table JOIN con diferentes agregaciones. Una sola query con SUM(CASE) reemplaza 4.",
        "dependencies": [],
        prompt: "Tarea: Consolidar JOINs repetidos en /api/stats/command (L3659-3855).\n\nArchivo: backend/src/server.ts\n\nUna sola query:\nSELECT COUNT(*) as total, SUM(CASE WHEN traffic_light='GREEN' THEN 1 ELSE 0 END) as green, ..., SUM(CASE WHEN needs_transport=1 THEN 1 ELSE 0 END) as transport\nFROM elector_captures ec LEFT JOIN electors e ... LEFT JOIN users u ... LEFT JOIN lists l ... LEFT JOIN campaigns c ...\nWHERE ec.is_disputed=0 [securityFilters]\n\nQuery por local separada (necesita GROUP BY).\nCach\u00e9 de electores totales se mantiene.\nObjetivo: <1s desde >3s.",
        tasks: ["Consolidar queries A,B,D en UNA con SUM(CASE)","Mantener query C (por local) separada","Mantener queries cacheadas","Verificar response id\u00e9ntico","Objetivo: <1s"]
      },
      {
        id: "1.6", name: "Optimizar LIKE '%...%' por hash index", effort: "1 d\u00eda",
        description: "B\u00fasquedas de tel\u00e9fono usan LIKE '%numero%' que fuerza full table scan de 500K electores.",
        dependencies: [],
        prompt: "Tarea: Optimizar b\u00fasquedas de tel\u00e9fono.\n\nArchivos: backend/src/server.ts, backend/src/db.ts\n\n1. Agregar columna phone_hash TEXT a electors y users\n2. CREATE INDEX idx_electors_phone_hash ON electors(phone_hash)\n3. Backfill script: UPDATE electors SET phone_hash = normalizePhone(telefono)\n4. normalizePhone: eliminar caracteres no num\u00e9ricos, prefijo 595/0\n5. Reemplazar LIKE por WHERE phone_hash = normalizePhone(?)\n6. Actualizar INSERT/UPDATE para mantener phone_hash",
        tasks: ["Agregar phone_hash + \u00edndices","Crear script de backfill","Modificar verify-phone y resolveRegisteredName","Actualizar INSERT/UPDATE para mantener hash"]
      }
    ]
  },
  {
    id: "fase-2", phase: 2,
    title: "Frontend \u2014 Que No se Sienta Lento",
    weeks: "Semana 6-8",
    objective: "Eliminar la percepci\u00f3n de lentitud con caching inteligente, renderizado eficiente, reportes server-side y eliminaci\u00f3n de polling.",
    groups: [
      {
        id: "2.1", name: "Agregar TanStack Query (React Query)", effort: "4-5 d\u00edas",
        description: "Cada p\u00e1gina reinventa fetching con useEffect+useState. Sin cach\u00e9, sin deduplicaci\u00f3n, sin stale-while-revalidate.",
        dependencies: [],
        prompt: "Tarea: Implementar TanStack Query.\n\n1. npm install @tanstack/react-query@5 + devtools\n2. QueryClientProvider en main.tsx: staleTime=30s, gcTime=5min, retry=2, refetchOnWindowFocus solo DEV\n3. Crear hooks: useStats, useCaptures, usePadrinoReport, useMyTeam, useCoverage, useUsers, useLocales\n4. Refactorizar CommandCenter, TeamPanel, CoordinatorApp, SuperAdmin, DiaDApp\n5. DevTools solo en desarrollo\n\nCada hook con useQuery({ queryKey: ['stats','command',distrito], queryFn: () => api.get(url).then(r=>r.data), staleTime: 15_000 })",
        tasks: ["Instalar @tanstack/react-query + devtools","Configurar QueryClientProvider","Crear hooks (useStats, useCaptures, usePadrinoReport, useMyTeam, useCoverage, useUsers, useLocales)","Refactorizar CommandCenter, TeamPanel, CoordinatorApp, SuperAdmin, DiaDApp"]
      },
      {
        id: "2.2", name: "Split CommandCenter en chunks lazy", effort: "2 d\u00edas",
        description: "CommandCenter pesa 627KB (Leaflet + mapa + reportes + sidebar). En 3G tarda 5-10s en descargar y parsear.",
        dependencies: [],
        prompt: "Tarea: Dividir CommandCenter en chunks lazy-loaded.\n\nArchivo: frontend/src/pages/CommandCenter.tsx\n\n1. Crear componentes separados:\n   - command-center/MapSection.tsx (Leaflet - lazy)\n   - command-center/ReportSection.tsx (html2canvas+jsPDF - lazy)\n   - command-center/ConflictSection.tsx (lazy)\n   - command-center/ActivitySection.tsx (lazy)\n2. Importar con React.lazy() + Suspense + Skeleton fallback\n3. html2canvas/jsPDF: dynamic import dentro del handler de click\n4. Verificar con npm run build que los chunks se dividen",
        tasks: ["Crear MapSection.tsx (lazy)","Crear ReportSection.tsx (lazy)","Crear ConflictSection.tsx (lazy)","Crear ActivitySection.tsx (lazy)","Refactorizar CommandCenter con React.lazy()+Suspense","Dynamic import de html2canvas/jsPDF en handler de click"]
      },
      {
        id: "2.3", name: "Mover reportes PDF/CSV al servidor", effort: "3-4 d\u00edas",
        description: "Reportes 100% client-side con html2canvas+jsPDF congelan el browser 10-30s para datasets grandes.",
        dependencies: ["2.2"],
        prompt: "Tarea: Mover generaci\u00f3n de reportes al servidor.\n\nBackend:\n1. GET /api/reports/padrinos/:id/pdf con pdfkit\n2. GET /api/reports/team/csv con escritura l\u00ednea por l\u00ednea\n3. GET /api/reports/disputes/pdf\n\nFrontend:\n1. Reemplazar html2canvas por descarga directa via API blob\n2. Botones de exportar: spinner + \"Generando...\"\n3. npm uninstall html2canvas jspdf jspdf-autotable (ahorra 354KB)\n4. Mantener html2canvas solo si se necesita capturar mapa",
        tasks: ["Crear GET /api/reports/padrinos/:id/pdf (pdfkit)","Crear GET /api/reports/team/csv","Crear GET /api/reports/disputes/pdf","Actualizar CommandCenter para descarga via blob","Actualizar TeamPanel para descarga via API","Eliminar html2canvas, jspdf, jspdf-autotable"]
      },
      {
        id: "2.4", name: "Reemplazar polling por SSE", effort: "3 d\u00edas",
        description: "Polling cada 30s (history), 3s (WhatsApp), 30s (sync), 4s (pending count). Drena bater\u00eda en mobile.",
        dependencies: [],
        prompt: "Tarea: Reemplazar polling por Server-Sent Events.\n\nBackend:\n1. Mejorar GET /api/stream/events con eventos estructurados + heartbeat 30s\n2. Emitir eventos desde handlers: capture.created, history.updated, broadcast.status, sync.progress\n\nFrontend:\n1. Crear useSSE() con EventSource + reconexi\u00f3n autom\u00e1tica (backoff 1s/2s/4s max 30s)\n2. Reemplazar polling en CoordinatorApp, BroadcastContext, MainLayout, SyncService\n3. Eliminar todos los setInterval de polling",
        tasks: ["Mejorar /api/stream/events con eventos estructurados + heartbeat","Emitir eventos SSE desde handlers","Crear hook useSSE() con reconexi\u00f3n","Reemplazar polling en CoordinatorApp, BroadcastContext, MainLayout, SyncService"]
      },
      {
        id: "2.5", name: "Virtual scrolling en listas grandes", effort: "2 d\u00edas",
        description: "Listas de electores, usuarios y activities sin virtualizaci\u00f3n. Con miles de items React renderiza todos los nodos DOM causando jank.",
        "dependencies": [],
        prompt: "Tarea: Implementar virtual scrolling con react-virtuoso.\n\n1. npm install react-virtuoso@4\n2. TeamPanel: tabla de electores con Virtuoso + sticky header\n3. SuperAdmin: tabla de usuarios\n4. CommandCenter: activity feed\n5. CoordinatorApp: historial de captures\n6. Configuraci\u00f3n: overscan=20, increaseViewportBy=200",
        tasks: ["Instalar react-virtuoso@4","Virtual scrolling en TeamPanel (electores)","Virtual scrolling en SuperAdmin (usuarios)","Virtual scrolling en CommandCenter (activity)","Virtual scrolling en CoordinatorApp (historial)"]
      },
      {
        id: "2.6", name: "Cache-aware Service Worker", effort: "2 d\u00edas",
        description: "Service Worker no cachea respuestas de API. Con CacheFirst+stale-while-revalidate las p\u00e1ginas ya visitadas cargan instant\u00e1neamente.",
        dependencies: [],
        prompt: "Tarea: Agregar runtimeCaching en service worker.\n\nArchivo: frontend/vite.config.ts (pwa config)\n\nAgregar runtimeCaching:\n- /api/stats/command: StaleWhileRevalidate, 60s\n- /api/locales: StaleWhileRevalidate, 300s\n- /api/campaigns: StaleWhileRevalidate, 300s\n- /api/lists: StaleWhileRevalidate, 300s\n- /api/users: NetworkFirst, 120s\n- /api/electors: NetworkFirst, 600s\n\nNO cachear: /api/login, /api/stream/events, /api/ping, POST/PUT/DELETE",
        tasks: ["Agregar runtimeCaching en vite.config.ts","Configurar StaleWhileRevalidate para stats/locales/campaigns/lists","Configurar NetworkFirst para users/electors","Excluir login, SSE, ping, POST/PUT/DELETE"]
      }
    ]
  },
  {
    id: "fase-3", phase: 3,
    title: "Infraestructura \u2014 Escalar sin Dolor",
    weeks: "Semana 9-10",
    objective: "Preparar la app para escalar con caching HTTP, Redis como capa compartida y evaluaci\u00f3n seria de migraci\u00f3n a PostgreSQL.",
    groups: [
      {
        id: "3.1", name: "Cache HTTP con ETag/Cache-Control", effort: "2 d\u00edas",
        description: "Ning\u00fan endpoint tiene headers de cach\u00e9. Con ETags y Cache-Control el browser puede servir respuestas cacheadas sin llegar al servidor.",
        "dependencies": [],
        prompt: "Tarea: Implementar headers de caching HTTP.\n\nArchivo: backend/src/server.ts\n\n1. Middleware de ETag autom\u00e1tico con crypto hash + If-None-Match 304\n2. Cache-Control: public, max-age=60 para locales/campaigns/lists\n3. Cache-Control: public, max-age=15 para stats/command, coverage, summary\n4. Cache-Control: no-cache, no-store para me, stream, ping, POST/PUT/DELETE\n5. Vary: Accept-Encoding, x-user-id, x-district",
        tasks: ["Middleware ETag con If-None-Match 304","Cache-Control a cat\u00e1logo (60s)","Cache-Control a dashboard (15s)","Cache-Control no-cache a endpoints sensibles","Configurar Vary header multitenant"]
      },
      {
        id: "3.2", name: "Redis para cach\u00e9 compartida", effort: "3 d\u00edas",
        description: "Cach\u00e9 actual est\u00e1 en memoria (Map). Si la app escala horizontalmente, cada instancia tiene su propio cach\u00e9. Redis permite cach\u00e9 compartido entre instancias.",
        "dependencies": [],
        prompt: "Tarea: Implementar Redis como capa de cach\u00e9 compartida.\n\nCrear backend/src/services/cache.ts:\n- CacheService con Redis (ioredis) + fallback a Map en memoria\n- Si REDIS_URL no configurado: solo memory cache (modo degraded)\n- get/set/invalidate con TTL paramétrico\n\nReemplazar Maps: userCache, electorsCountCache, totalElectorsCache, electorCountsByLocalCache\n\nNo usar Redis para datos sensibles (solo cache, no sesiones ni auth).",
        tasks: ["Instalar ioredis y crear CacheService con fallback a memoria","Reemplazar userCache, electorsCountCache, totalElectorsCache","Configurar REDIS_URL en env con fallback graceful","Probar sin Redis: debe funcionar con memory cache"]
      },
      {
        id: "3.3", name: "Evaluaci\u00f3n PostgreSQL vs SQLite", effort: "1-2 d\u00edas",
        description: "SQLite es excelente para single-server pero tiene l\u00edmites: sin replicaci\u00f3n, sin conexiones concurrentes reales, better-sqlite3 bloquea event loop.",
        "dependencies": [],
        prompt: "Tarea: Evaluar si migrar a PostgreSQL es necesario. NO ejecutar migraci\u00f3n, solo evaluar.\n\nSQLite suficiente si: single-instance, <1GB, lecturas concurrentes con WAL, sin replicación necesaria.\n\nPostgreSQL ayuda si: múltiples instancias, >5GB, replicación necesaria, queries async.\n\nCosto migraci\u00f3n: 1-2 semanas + riesgo de regresión en cada query.\n\nRECOMENDACI\u00d3N: NO migrar ahora. Reevaluar post-Fase 2 si optimizaciones no resuelven problemas.\n\nCondiciones para migrar:\na) Múltiples instancias en producción\nb) Volumen de datos >5-10GB\nc) Queries agregadas siguen lentas post-optimizaci\u00f3n\nd) Se necesita replicaci\u00f3n geográfica",
        tasks: ["Evaluar pros/cons SQLite vs PostgreSQL","Estimar esfuerzo de migraci\u00f3n (1-2 semanas)","Documentar condiciones para migrar","Conclusi\u00f3n: mantener SQLite post-Fase 2"]
      },
      {
        id: "3.4", name: "Migraci\u00f3n a PostgreSQL (Plan B)", effort: "1-2 semanas",
        description: "SOLO si 3.3 determina que SQLite no puede sostener el crecimiento. Migraci\u00f3n completa: driver async, queries reescritos, datos migrados.",
        "dependencies": ["3.3"],
        prompt: "SOLO EJECUTAR SI 3.3 LO RECOMIENDA.\n\nTarea: Migrar SQLite a PostgreSQL.\n\n1. Instalar pg + pg-pool, crear pool.ts con Pool({ max: 20 })\n2. Crear helpers async: dbQuery(sql, params), dbGet(sql, params), dbRun(sql, params)\n3. Reescribir server.ts: cambiar better-sqlite3 sync por pool.query() async\n4. Transacciones: BEGIN/COMMIT async con try/catch\n5. Migrar datos con pgloader o script batch (LIMIT 5000 OFFSET X)\n6. Verificar integridad: contar filas por tabla, ejecutar queries cr\u00edticas\n7. Corte: maintenance window 15-30 min, rollback plan 1 semana\n\nDiferencias SQLite vs PG:\n- GROUP BY: PG requiere todas las columnas no agregadas\n- ILIKE para case-insensitive\n- CURRENT_TIMESTAMP funciona igual\n- CTEs compatibles",
        tasks: ["Instalar pg + pg-pool, crear pool.ts","Reescribir db.ts para PG","Adaptar server.ts: sync a async","Migrar transacciones a BEGIN/COMMIT async","Ejecutar pgloader para migrar datos","Verificar integridad (counts, queries cr\u00edticas)","Corte a PG con rollback plan 1 semana"]
      },
      {
        id: "3.5", name: "Monitoreo con Sentry", effort: "1 d\u00eda",
        description: "Sin monitoreo de errores no sab\u00e9s qu\u00e9 pasa en producci\u00f3n. Sentry free tier captura errores 500, performance tracing y breadcrumbs.",
        "dependencies": [],
        prompt: "Tarea: Configurar Sentry en backend y frontend.\n\nBackend: @sentry/node\n- Sentry.init con tracesSampleRate=0.1 en prod\n- requestHandler + errorHandler de Express\n- setUser con id y distrito\n\nFrontend: @sentry/react\n- Sentry.init con browserTracingIntegration + replayIntegration\n- Reemplazar ErrorBoundary por Sentry.ErrorBoundary\n- replaysOnErrorSampleRate=1.0\n\nVariables: SENTRY_DSN (backend), VITE_SENTRY_DSN (frontend)\nSi vac\u00edo: Sentry desactivado, no crash.",
        tasks: ["Configurar @sentry/node en backend","Agregar user context y breadcrumbs","Configurar @sentry/react en frontend","Reemplazar ErrorBoundary por Sentry.ErrorBoundary"]
      }
    ]
  },
  {
    id: "fase-4", phase: 4,
    title: "Producci\u00f3n \u2014 Hardening Final",
    weeks: "Semana 11-12",
    objective: "Seguridad, tests automatizados, CI/CD repetible y logging estructurado. La app debe poder desplegarse con confianza.",
    groups: [
      {
        id: "4.1", name: "Rate limiting y seguridad", effort: "2 d\u00edas",
        description: "No hay rate limiting. Sin headers de seguridad (HSTS, CSP, X-Frame-Options). Endpoints cr\u00edticos sin protecci\u00f3n.",
        "dependencies": [],
        prompt: "Tarea: Rate limiting + headers de seguridad.\n\nInstalar: express-rate-limit, helmet\n\nRate limits:\n- POST /api/login: 5/min por IP\n- GET /api/*: 100/min por usuario\n- POST /api/captures: 30/min por usuario\n- Upload: 10/min por usuario\n\nHelmet: HSTS 1 a\u00f1o, frameguard deny, noSniff, xssFilter, referrerPolicy strict-origin\n\nValidaci\u00f3n inputs: coordenadas v\u00e1lidas, traffic_light enum, formatos CI/email/tel\u00e9fono.",
        tasks: ["Rate limits por endpoint (login 5/min, API 100/min, captures 30/min)","Helmet headers (HSTS, X-Frame, XSS, noSniff)","Validaci\u00f3n de inputs en endpoints cr\u00edticos"]
      },
      {
        id: "4.2", name: "Tests de regresi\u00f3n", effort: "4-5 d\u00edas",
        description: "Sin tests. Cualquier cambio puede romper algo. Tests de integraci\u00f3n contra SQLite in-memory para endpoints cr\u00edticos.",
        "dependencies": [],
        prompt: "Tarea: Suite de tests con Vitest.\n\n1. npm install -D vitest, configurar vitest.config.ts\n2. tests/integration/helpers.ts:\n   - setupTestDB(): SQLite :memory: con schema completo\n   - seedTestData(): 1 campaign, 1 list, 3 users, 1 elector, 1 capture\n   - createTestApp(): Express con DB de test\n\n3. Tests:\n   - Auth: login exitoso, fallido, rate limit\n   - Captures: create exitoso, CI inv\u00e1lido, traffic_light inv\u00e1lido, duplicado\n   - Stats: /stats/command, /diad/coverage, /my-team/reports\n   - Users: CRUD b\u00e1sico\n\n4. Coverage m\u00ednimo 60% en server.ts\n5. npm test debe pasar en CI",
        tasks: ["Configurar Vitest con SQLite in-memory","Crear helpers: setupTestDB, seedTestData, createTestApp","Tests de auth, captures, stats, users","Configurar coverage 60%","npm test debe pasar en CI"]
      },
      {
        id: "4.3", name: "CI/CD pipeline", effort: "1-2 d\u00edas",
        description: "Sin CI/CD. Cada push puede romper producci\u00f3n. Pipeline: lint \u2192 typecheck \u2192 test \u2192 build \u2192 deploy.",
        "dependencies": ["4.2"],
        prompt: "Tarea: CI/CD con GitHub Actions.\n\nCrear .github/workflows/ci.yml:\n\non: push/PR a main\n\njobs:\n  quality:\n    - setup Node 20\n    - cd backend && npm ci\n    - cd frontend && npm ci\n    - npx tsc --noEmit (backend + frontend)\n    - npm run lint (backend + frontend)\n    - cd backend && npm test\n    - cd frontend && npm run build\n  \n  deploy:\n    needs: quality\n    if: github.ref == 'refs/heads/main'\n    - curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}\n\nAgregar badge de CI status al README.",
        tasks: ["Crear .github/workflows/ci.yml","Configurar secrets (RENDER_DEPLOY_HOOK)","Agregar badge de CI status","Verificar pipeline pasa en push a main"]
      },
      {
        id: "4.4", name: "Logging estructurado", effort: "1 d\u00eda",
        description: "console.log disperso sin estructura. En producci\u00f3n es imposible saber qu\u00e9 pas\u00f3 cuando algo falla.",
        "dependencies": [],
        prompt: "Tarea: Logging estructurado con pino.\n\n1. npm install pino pino-http pino-pretty\n2. Crear backend/src/utils/logger.ts:\n   - Nivel: LOG_LEVEL env o info en prod / debug en dev\n   - Transport: pino-pretty en dev, JSON en prod\n   - Serializers: req (method, url, userId), res (statusCode)\n   - Redact: passwords, tokens, cookies\n3. pino-http middleware (excluir /api/ping)\n4. Reemplazar console.log por logger.info/warn/error\n5. Request ID: crypto.randomUUID() por request",
        tasks: ["Instalar pino + pino-http + pino-pretty","Crear logger.ts con configuraci\u00f3n por ambiente","Middleware HTTP logging con pino-http","Reemplazar console.log por logger","Request ID por request"]
      }
    ]
  },
  {
    id: "fase-5", phase: 5,
    title: "Experiencia \u2014 UX que Vende",
    weeks: "Semana 13-14",
    objective: "Refinamiento final de UX: coordinadores, padrinos y administradores usan la app sin fricci\u00f3n. Cero esperas, feedback inmediato, dise\u00f1o pulido.",
    groups: [
      {
        id: "5.1", name: "Skeleton loading completo en todas las p\u00e1ginas", effort: "2 d\u00edas",
        description: "SuperAdmin, DiaDApp, Communications, LogisticsApp, VeedorApp no tienen estados de carga. Muestran pantalla en blanco mientras cargan.",
        "dependencies": [],
        prompt: "Tarea: Completar skeleton loading en p\u00e1ginas faltantes.\n\nUsar SkeletonCard, SkeletonTable, SkeletonText existentes.\n\nP\u00e1ginas:\n- SuperAdmin: SkeletonTable en tabs Usuarios/Campa\u00f1as/Listas\n- DiaDApp: SkeletonCard para KPIs, SkeletonTable para miembros\n- Communications: SkeletonList para plantillas/broadcasts/mensajes\n- LogisticsApp: SkeletonTable para veh\u00edculos, SkeletonCard para stats\n- VeedorApp: SkeletonTable para mesas/resultados\n\nMostrar skeletons INMEDIATAMENTE al montar. Transici\u00f3n suave a contenido real con opacity CSS.",
        tasks: ["Skeleton en SuperAdmin (tabs)","Skeleton en DiaDApp (KPIs, miembros)","Skeleton en Communications","Skeleton en LogisticsApp","Skeleton en VeedorApp"]
      },
      {
        id: "5.2", name: "Offline-first improvements", effort: "3 d\u00edas",
        description: "Experiencia offline pobre. Sin conexi\u00f3n las APIs fallan silenciosamente. Mejorar: detectar online/offline, mostrar banner, cola de acciones.",
        "dependencies": [],
        prompt: "Tarea: Mejorar experiencia offline.\n\n1. Hook useOnlineStatus(): eventos online/offline del window\n2. Banner offline: \"Sin conexi\u00f3n — datos guardados localmente\"\n3. Banner online recovery: \"Conexi\u00f3n restablecida — sincronizando...\"\n4. TanStack Query con staleTime+gcTime para datos offline\n5. Acciones offline: crear capture encolada en IndexedDB + badge \"Pendiente de sincronizar\"\n6. Mejorar SyncService: sync inmediato al recuperar conexi\u00f3n\n7. SW: cachear GET /api con NetworkFirst + fallback a cache",
        tasks: ["Crear useOnlineStatus()","Banner de conectividad en MainLayout","Cachear GET API en SW con NetworkFirst","Acciones offline con badge 'pendiente de sincronizar'","Sync inmediato al recuperar conexi\u00f3n"]
      },
      {
        id: "5.3", name: "Exportaci\u00f3n y reportes mejorados", effort: "2 d\u00edas",
        description: "Exportaci\u00f3n limitada a PDF/CSV. Mejorar con Excel (xlsx), selector de columnas, filtros pre-aplicados y batch download.",
        "dependencies": [],
        prompt: "Tarea: Mejorar exportaci\u00f3n de datos.\n\n1. GET /api/reports/export/xlsx: endpoint que genera Excel con openpyxl o exceljs\n   - Columnas seleccionables via query params: ?columns=nombre,ci,telefono\n   - Filtros pre-aplicados: ?distrito=&traffic_light=&fecha_desde=\n\n2. Bot\u00f3n \"Exportar todo\" en TeamPanel que descarga XLSX con todas las tablas visibles\n\n3. Selector de columnas:\n   - Modal con checkboxes de columnas disponibles\n   - Recordar \u00faltima selecci\u00f3n en localStorage\n\n4. Exportaci\u00f3n batch:\n   - Seleccionar m\u00faltiples items con checkbox\n   - Bot\u00f3n \"Exportar seleccionados\"",
        tasks: ["Endpoint GET /api/reports/export/xlsx","Selector de columnas para exportaci\u00f3n","Exportaci\u00f3n batch con selecci\u00f3n m\u00faltiple","Recordar preferencias en localStorage"]
      },
      {
        id: "5.4", name: "Performance budget y monitoreo", effort: "1 d\u00eda",
        description: "Sin m\u00e9tricas de performance no sab\u00e9s si est\u00e1s mejorando o empeorando. Definir budgets y medir con Lighthouse CI.",
        "dependencies": [],
        prompt: "Tarea: Definir performance budgets y medirlos.\n\n1. Performance budgets en CI:\n   - Tama\u00f1o total JS: <500KB gzip\n   - CommandCenter chunk: <200KB\n   - TTFB: <200ms\n   - First Contentful Paint: <1.5s\n   - Time to Interactive: <3s\n\n2. Lighthouse CI en GitHub Actions:\n   - Ejecutar lighthouse en cada PR\n   - Falla si alg\u00fan budget se supera\n   - Reporte en comentario del PR\n\n3. Web Vitals tracking con PerformanceObserver:\n   - LCP, FID/INP, CLS\n   - Enviar a Sentry como breadcrumbs\n\n4. Budgets definidos en archivo de configuraci\u00f3n:\n   lighthouserc.json con thresholds",
        tasks: ["Definir performance budgets (JS<500KB, TTFB<200ms, FCP<1.5s)","Configurar Lighthouse CI en GitHub Actions","Web Vitals tracking con PerformanceObserver","Lighthouse budget config file"]
      }
    ]
  },
  {
    id: "fase-6", phase: 6,
    title: "Ajustes Finos — Event Loop & Query Optimization",
    weeks: "Semana 7",
    objective: "Desbloquear el event loop de Node.js moviendo queries pesadas a worker threads (piscina), completar migración de phone_hash, y eliminar LIKE en búsquedas de teléfono.",
    groups: [
      {
        id: "6.1", name: "Worker threads con piscina para queries pesadas", effort: "1 día",
        description: "better-sqlite3 es sincrónico y bloquea el event loop en cada query. Usar piscina (pool de worker threads) para ejecutar lecturas pesadas en threads separados, liberando el event loop para servir otros requests.",
        dependencies: ["0.4"],
        prompt: "Tarea: Implementar worker thread pool con piscina.\n\n1. npm install piscina\n2. Crear backend/src/db-worker.ts: abre conexión SQLite read-only con WAL, exporta función runQuery({sql, params, method})\n3. Crear backend/src/db-async.ts: pool de piscina (3 threads max), exporta dbQueryAsync<T>(sql, params) y dbGetAsync<T>(sql, params)\n4. Migrar endpoints pesados a usar dbQueryAsync/dbGetAsync: stats/command, my-team/reports, diad/coverage, full-report\n5. Mantener db.prepare() para writes y queries ligeras (<5ms)",
        tasks: ["Instalar piscina","Crear db-worker.ts con conexión read-only","Crear db-async.ts con pool wrapper","Migrar stats/command a async workers","Migrar my-team/reports a async workers","Migrar diad/coverage a async workers","Migrar full-report a async workers"]
      },
      {
        id: "6.2", name: "Completar migración phone_hash", effort: "Medio día",
        description: "La tarea 1.6 del roadmap fue marcada como completada pero quedaron queries usando LIKE '%phone%' en endpoints de búsqueda (whatsapp/recipients/search, verify-phone, resolveRegisteredName).",
        dependencies: ["1.6"],
        prompt: "Tarea: Completar migración a phone_hash en todas las queries de teléfono.\n\n1. verify-phone: cambiar LIKE '%phone%' por phone_hash = normalizePhone(phone)\n2. resolveRegisteredName: cambiar LIKE '%phone%' por phone_hash = normalizePhone(phone)\n3. whatsapp/recipients/search: detectar si query es numérica → usar phone_hash = ? en vez de telefono LIKE ?\n4. Importar normalizePhone en server.ts",
        tasks: ["Fix verify-phone endpoint","Fix resolveRegisteredName","Fix whatsapp/recipients/search","Verificar que phone_hash está indexado"]
      },
      {
        id: "6.3", name: "Corregir logger pino en servicios", effort: "30 min",
        description: "pino no soporta logger.error('msg:', err) estilo console.error. Corregir todas las llamadas a logger.error({ err }, 'message') en cache.ts y otros servicios.",
        dependencies: ["0.6"],
        prompt: "Tarea: Corregir firmas de logger pino.\n\nArchivo: backend/src/services/cache.ts\n\nCambiar: logger.error('msg:', err) → logger.error({ err }, 'msg')\nCambiar: logger.warn('msg') OK\nCambiar: logger.info('msg') OK\n\nPino espera: logger.level(mergingObject, 'message')",
        tasks: ["Corregir 6 llamadas a logger.error en cache.ts","Verificar otros archivos con logger"]
      }
    ]
  }
];