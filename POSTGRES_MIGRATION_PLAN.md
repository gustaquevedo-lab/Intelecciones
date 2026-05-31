# Plan de Migración a PostgreSQL (Plan B)
**Proyecto: Intelecciones — Infraestructura**

Este documento detalla el procedimiento y las adaptaciones técnicas necesarias para migrar el motor de base de datos de **SQLite** a **PostgreSQL** de forma segura en caso de que sea requerido por necesidades de escalabilidad horizontal.

---

## 1. Mapeo de Tipos de Datos y Esquema

| Tipo SQLite | Tipo PostgreSQL Equivalente | Notas |
| :--- | :--- | :--- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` o `BIGSERIAL` | Generación automática en inserts. |
| `TEXT` | `VARCHAR(255)` o `TEXT` | `TEXT` para campos ilimitados, `VARCHAR` para hashes o estados. |
| `INTEGER` (Booleano) | `BOOLEAN` | SQLite usa 0/1; Postgres usa true/false nativos. |
| `DATETIME` | `TIMESTAMP WITH TIME ZONE` | Postgres maneja zonas horarias de forma explícita. |

### DDL Migrado (Ejemplo: Tabla `users`)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    photo_url TEXT,
    ci VARCHAR(50),
    telefono VARCHAR(50),
    phone_hash VARCHAR(64),
    assigned_list_id INTEGER,
    assigned_campaign_id INTEGER,
    distrito VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    needs_password_change BOOLEAN DEFAULT FALSE,
    enabled_modules TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_phone_hash ON users(phone_hash);
```

---

## 2. Configuración del Driver Asíncrono (`pg`)

Para integrarse de forma no bloqueante con Express en Node.js, se utilizará la biblioteca `pg-pool`:

```typescript
// backend/src/db_postgres.ts
import { Pool } from 'pg';
import logger from './utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Límite máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Error inesperado en el pool de Postgres:', err);
});

export default pool;
```

---

## 3. Adaptaciones en Consultas y Transacciones

Dado que `better-sqlite3` es de naturaleza síncrona y PostgreSQL es asíncrona, todos los endpoints requerirán actualización.

### Lecturas Simples
- **Antes (SQLite):**
  ```typescript
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  ```
- **Después (Postgres):**
  ```typescript
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  const user = result.rows[0] || null;
  ```

### Transacciones
- **Antes (SQLite):**
  ```typescript
  const transaction = db.transaction((data) => {
    for (const item of data) insert.run(item);
  });
  transaction(payload);
  ```
- **Después (Postgres):**
  ```typescript
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of payload) {
      await client.query('INSERT INTO ... VALUES ($1, $2)', [item.a, item.b]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  ```

---

## 4. Estrategia de Migración de Datos (Zero-Downtime)

1. **Dump y Restauración del Esquema:** Crear la base de datos vacía en PostgreSQL con la DDL adaptada.
2. **Script de Migración Batch:** Escribir un script Node.js que lea en bloques (ej. `LIMIT 5000 OFFSET X`) de SQLite y escriba asíncronamente en PostgreSQL usando consultas paralelizadas o `pg-copy-streams` para optimizar velocidad.
3. **Validación de Integridad:** Ejecutar consultas de conteo (`COUNT(*)`) y sumatorias sobre ambas bases de datos para contrastar los resultados.
4. **Corte y Rollback:**
   - Programar ventana de mantenimiento (15 minutos).
   - Detener el servidor de backend.
   - Correr sincronización final de datos.
   - Cambiar variables de entorno `DATABASE_URL` para apuntar a Postgres.
   - Iniciar servidor con el código adaptado asíncrono.
   - En caso de falla crítica, cambiar variable a SQLite para rollback inmediato.
