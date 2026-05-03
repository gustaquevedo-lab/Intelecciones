const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

try {
    console.log('Patching database at:', dbPath);
    // Add columns if they don't exist
    try { db.exec('ALTER TABLE users ADD COLUMN assigned_local TEXT'); } catch(e) {}
    try { db.exec('ALTER TABLE users ADD COLUMN assigned_mesa INTEGER'); } catch(e) {}
    
    // Assign a default table to existing admins so they can see the Veedor grid
    db.prepare("UPDATE users SET assigned_local = ?, assigned_mesa = ? WHERE role = 'SUPERUSUARIO' OR role = 'JEFE_CAMPANA'")
      .run('ESC. BAS. CARLOS ANTONIO LOPEZ', 1);
      
    // Verify admin photo_url
    const admin = db.prepare("SELECT photo_url FROM users WHERE role = 'SUPERUSUARIO'").get();
    console.log('Admin Photo URL:', admin?.photo_url);
    
    console.log('Database patched successfully.');
} catch (err) {
    console.error('Patch failed:', err);
}
process.exit(0);
