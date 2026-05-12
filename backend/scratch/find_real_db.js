const fs = require('fs');
const path = require('path');

function findDB(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const fullPath = path.join(dir, f);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (f !== 'node_modules' && f !== '.git') findDB(fullPath);
            } else if (f.endsWith('.db') || f.endsWith('.sqlite')) {
                const buffer = Buffer.alloc(16);
                const fd = fs.openSync(fullPath, 'r');
                fs.readSync(fd, buffer, 0, 16, 0);
                fs.closeSync(fd);
                if (buffer.toString().startsWith('SQLite format 3')) {
                    console.log('VALID SQLITE DB:', fullPath, 'Size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
                }
            }
        } catch (e) {}
    }
}

console.log('Searching for valid SQLite databases...');
findDB('c:\\Users\\Gustavo\\OneDrive\\Dev\\Intelecciones');
