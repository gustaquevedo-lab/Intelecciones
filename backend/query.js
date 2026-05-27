const db = require('better-sqlite3')('intellecciones.db');
const cols = db.prepare(`PRAGMA table_info(whatsapp_broadcast_logs)`).all();
console.log(JSON.stringify(cols, null, 2));
