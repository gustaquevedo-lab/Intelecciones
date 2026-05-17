const fs = require('fs');
const path = require('path');

function findDB(dir, depth = 0) {
    if (depth > 6) return;
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
                findDB(fullPath, depth + 1);
            } else {
                // If it is a file and is larger than 10KB
                if (stat.size > 10 * 1024) {
                    const fd = fs.openSync(fullPath, 'r');
                    const buf = Buffer.alloc(16);
                    fs.readSync(fd, buf, 0, 16, 0);
                    fs.closeSync(fd);
                    
                    if (buf.toString('utf8').startsWith('SQLite format 3') || buf.toString('hex').includes('53514c697465')) {
                        console.log('FOUND SQLITE:', fullPath, 'Size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
                    } else if (buf.toString('hex').startsWith('fffe') || buf.toString('hex').startsWith('feff')) {
                        // Check if it starts with UTF-16 BOM and has SQLITE format
                        console.log('FOUND UTF-16 FILE:', fullPath, 'Size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
                    }
                }
            }
        } catch (e) {}
    }
}

console.log('Searching for sqlite databases in Gemini App Data directory...');
findDB('C:\\Users\\Gustavo Quevedo\\.gemini\\antigravity');
