const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbs = [
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\intellecciones.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\intellecciones.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\temp_db_95b.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\ruvector.db'
];

dbs.forEach(dbPath => {
  if (fs.existsSync(dbPath)) {
    try {
      const db = new Database(dbPath);
      const electorsCount = db.prepare("SELECT COUNT(*) as count FROM electors").get().count;
      const localesCount = db.prepare("SELECT COUNT(*) as count FROM voting_locations").get().count;
      console.log(`DB: ${path.basename(dbPath)} - Size: ${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Electors: ${electorsCount}`);
      console.log(`  Voting locations: ${localesCount}`);
      if (electorsCount > 0) {
        const districts = db.prepare("SELECT DISTINCT distrito FROM electors LIMIT 5").all();
        console.log(`  Sample districts:`, districts);
      }
    } catch (e) {
      console.log(`DB: ${path.basename(dbPath)} - Error: ${e.message}`);
    }
  } else {
    console.log(`DB: ${path.basename(dbPath)} - Does not exist`);
  }
});
