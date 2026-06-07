const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('intellecciones.db');
const lists = db.prepare('SELECT * FROM lists ORDER BY id').all();

const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
};

let sql = '-- Lists export for production sync\n';
sql += '-- Run this via Railway shell or psql equivalent\n\n';
sql += 'DELETE FROM lists;\n\n';

lists.forEach(l => {
  sql += `INSERT INTO lists (id, campaign_id, type, list_number, option_number, candidate_ci, candidate_nombre, candidate_alias, goal, photo_url, ciudad, is_adversary) VALUES (${
    [l.id, l.campaign_id, l.type, l.list_number, l.option_number, l.candidate_ci, l.candidate_nombre, l.candidate_alias, l.goal, l.photo_url, l.ciudad, l.is_adversary].map(esc).join(',')
  });\n`;
});

fs.writeFileSync('lists_export.sql', sql);
console.log('Exported', lists.length, 'lists to lists_export.sql');
