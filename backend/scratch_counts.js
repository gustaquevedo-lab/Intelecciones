const Database = require('better-sqlite3');
const path = require('path');
const db1 = new Database(path.join(__dirname, 'intellecciones.db'));
const db2 = new Database(path.join(__dirname, '..', 'intellecciones.db'));
console.log('db1 electors count:', db1.prepare('SELECT count(*) as c from electors').get().c);
console.log('db1 captures count:', db1.prepare('SELECT count(*) as c from elector_captures').get().c);
console.log('db2 electors count:', db2.prepare('SELECT count(*) as c from electors').get().c);
console.log('db2 captures count:', db2.prepare('SELECT count(*) as c from elector_captures').get().c);
