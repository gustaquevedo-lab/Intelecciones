const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.prepare('CREATE TABLE t (id INTEGER, val INTEGER)').run();
db.prepare('INSERT INTO t VALUES (1, 10)').run();
try {
  db.prepare('UPDATE t SET val = ? WHERE id = 1').run(NaN);
  console.log('SUCCESS:', db.prepare('SELECT * FROM t').get());
} catch(e) {
  console.error('ERROR:', e.message);
}
