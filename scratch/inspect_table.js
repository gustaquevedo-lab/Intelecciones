const db = require('better-sqlite3')('c:/Users/Gustavo/OneDrive/Dev/Intelecciones/backend/data/database.sqlite');
console.log(JSON.stringify(db.prepare('PRAGMA table_info(elector_captures)').all(), null, 2));
