const Database = require('better-sqlite3');
const db = new Database('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\intellecciones.db');

try {
  console.log('Campaigns:');
  console.log(db.prepare('SELECT * FROM campaigns').all());
  
  console.log('Electors:');
  console.log(db.prepare('SELECT * FROM electors').all());
  
  console.log('Users:');
  console.log(db.prepare('SELECT * FROM users').all());
  
} catch (e) {
  console.error(e);
}
db.close();
