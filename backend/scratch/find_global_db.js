const fs = require('fs');
const path = require('path');

function findDB(dir, depth = 0) {
    if (depth > 4) return;
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
                    findDB(fullPath, depth + 1);
                }
            } else if (f === 'intellecciones.db') {
                console.log('FOUND DB:', fullPath, 'Size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
            }
        } catch (e) {}
    }
}

console.log('Searching for intellecciones.db in Dev parent folder...');
findDB('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev');
