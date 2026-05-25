const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('backend/intellecciones.db');

try {
  // Check tables, count rows
  const usersCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const electorsCount = db.prepare("SELECT COUNT(*) as c FROM electors").get().c;
  const capturesCount = db.prepare("SELECT COUNT(*) as c FROM elector_captures").get().c;
  console.log(`Row counts: users=${usersCount}, electors=${electorsCount}, captures=${capturesCount}`);

  // List all indexes
  const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'").all();
  console.log('Indexes in database:', indexes);

  // Let's run EXPLAIN QUERY PLAN on the queries
  const q1 = `
    EXPLAIN QUERY PLAN
    SELECT ec.id, ec.timestamp
    FROM electors e INDEXED BY idx_electors_distrito
    INNER JOIN elector_captures ec ON ec.elector_ci = e.ci
    LEFT JOIN users u ON ec.coordinator_id = u.id
    LEFT JOIN lists l ON ec.list_id = l.id
    WHERE e.distrito = 'ASUNCION'
  `;
  console.log('Q1 Query Plan:', db.prepare(q1).all());

  const q2 = `
    EXPLAIN QUERY PLAN
    SELECT ec.id, ec.timestamp
    FROM users u INDEXED BY idx_users_distrito
    INNER JOIN elector_captures ec ON ec.coordinator_id = u.id
    LEFT JOIN electors e ON ec.elector_ci = e.ci
    LEFT JOIN lists l ON ec.list_id = l.id
    WHERE u.distrito = 'ASUNCION'
  `;
  console.log('Q2 Query Plan:', db.prepare(q2).all());

} catch (err) {
  console.error('ERROR in test:', err);
}
