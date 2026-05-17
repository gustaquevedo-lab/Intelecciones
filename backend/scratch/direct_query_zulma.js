const Database = require('better-sqlite3');
const dbPath = 'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\intellecciones.db';
const db = new Database(dbPath);

try {
  console.log("Searching for users in:", dbPath);
  const users = db.prepare("SELECT id, nombre, username, role, parent_id, distrito FROM users").all();
  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    console.log(`  ID: ${u.id}, Name: ${u.nombre}, Username: ${u.username}, Role: ${u.role}, Parent: ${u.parent_id}, District: ${u.distrito}`);
  }
  
  const captures = db.prepare("SELECT COUNT(*) as count FROM elector_captures").get();
  console.log(`Captures count: ${captures.count}`);
} catch (e) {
  console.error("Error:", e);
}
