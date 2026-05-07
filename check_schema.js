const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('backend/src/intellecciones.db');
const columns = db.prepare("PRAGMA table_info(electors)").all();
console.log(JSON.stringify(columns, null, 2));
const campaigns = db.prepare("PRAGMA table_info(campaigns)").all();
console.log('Campaigns:', JSON.stringify(campaigns, null, 2));
