const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'temp_db_95b.db');
console.log('Inspecting DB at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('File does not exist!');
  process.exit(1);
}

const db = new Database(dbPath);
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables in temp_db_95b.db:", tables.map(t => t.name).join(", "));
  
  if (tables.some(t => t.name === 'users')) {
    const userRoles = db.prepare("SELECT role, COUNT(*) as count FROM users GROUP BY role").all();
    console.log("User counts by role:", userRoles);
  }
  
  if (tables.some(t => t.name === 'electors')) {
    const electorsCount = db.prepare("SELECT COUNT(*) as count FROM electors").get().count;
    console.log("Elector count:", electorsCount);
  }
  
  if (tables.some(t => t.name === 'campaigns')) {
    const campaigns = db.prepare("SELECT * FROM campaigns").all();
    console.log("Campaigns:", campaigns);
  }
} catch (e) {
  console.error("Error inspecting:", e);
}
