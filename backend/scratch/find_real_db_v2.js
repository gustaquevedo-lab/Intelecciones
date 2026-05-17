const fs = require('fs');
const path = require('path');

function findDB(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return;
    }
    for (const f of files) {
        const fullPath = path.join(dir, f);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (f !== 'node_modules' && f !== '.git' && f !== 'brain' && f !== '.claude') {
                    findDB(fullPath);
                }
            } else if (f.endsWith('.db') || f.endsWith('.sqlite')) {
                if (stat.size > 0) {
                    const buffer = Buffer.alloc(16);
                    const fd = fs.openSync(fullPath, 'r');
                    fs.readSync(fd, buffer, 0, 16, 0);
                    fs.closeSync(fd);
                    if (buffer.toString().startsWith('SQLite format 3')) {
                        console.log('VALID SQLITE DB:', fullPath, 'Size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
                    } else {
                        console.log('INVALID DB (not sqlite):', fullPath, 'Size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
                    }
                } else {
                    console.log('EMPTY DB (0 bytes):', fullPath);
                }
            }
        } catch (e) {}
    }
}

console.log('Searching for valid SQLite databases in workspace...');
findDB('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones');
