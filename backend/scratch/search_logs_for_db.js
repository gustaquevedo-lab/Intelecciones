const fs = require('fs');
const path = require('path');

function searchLogs(dir) {
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
                searchLogs(fullPath);
            } else if (f === 'overview.txt') {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('temp_db_95b.db')) {
                    const relativePath = path.relative('C:\\Users\\Gustavo Quevedo\\.gemini\\antigravity\\brain', fullPath);
                    console.log('MATCH IN LOGS:', relativePath);
                    
                    // Let's find some snippets
                    const idx = content.indexOf('temp_db_95b.db');
                    console.log('Snippet:', content.substring(Math.max(0, idx - 150), Math.min(content.length, idx + 250)));
                    console.log('----------------------------------------------------');
                }
            }
        } catch (e) {}
    }
}

console.log('Searching previous conversation logs for temp_db_95b.db...');
searchLogs('C:\\Users\\Gustavo Quevedo\\.gemini\\antigravity\\brain');
