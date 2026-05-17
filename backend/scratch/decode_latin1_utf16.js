const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const corruptedPath = path.join(__dirname, '..', 'temp_db_95b.db');
const recoveredPath = path.join(__dirname, '..', 'recovered_intellecciones.db');

console.log('Attempting Latin1 -> UTF-16LE recovery...');

try {
    // Read corrupted file as UTF-16 LE string
    const textContent = fs.readFileSync(corruptedPath, 'utf16le');
    
    // Write back as Latin1 string (binary direct mapping)
    fs.writeFileSync(recoveredPath, textContent, 'latin1');
    
    const recoveredSize = fs.statSync(recoveredPath).size;
    console.log('Successfully wrote recovered file. Size:', recoveredSize, 'bytes');
    
    // Verify SQLite integrity
    const db = new Database(recoveredPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('SUCCESS! Tables in recovered DB:', tables.map(t => t.name).join(', '));
    
    if (tables.some(t => t.name === 'users')) {
        const roles = db.prepare("SELECT role, COUNT(*) as count FROM users GROUP BY role").all();
        console.log('User counts by role:', roles);
        
        const subjefes = db.prepare("SELECT id, username, nombre, role, parent_id, distrito FROM users WHERE role = 'SUBJEFE'").all();
        console.log('Subjefes in DB:', subjefes);
    }
    db.close();
} catch (e) {
    console.error('Failed recovery:', e);
}
