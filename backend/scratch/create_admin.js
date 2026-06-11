const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

try {
  db.prepare(`
    INSERT OR REPLACE INTO users (id, username, password, role, nombre, distrito, ci, status)
    VALUES (1, 'admin', 'admin123', 'SUPERUSUARIO', 'Administrador', 'PEDRO JUAN CABALLERO', '1111111', 'ACTIVE')
  `).run();
  console.log("Admin user created/updated successfully.");
  console.log(db.prepare("SELECT * FROM users WHERE username='admin'").all());
} catch (e) {
  console.error("Error creating admin user:", e);
}
