const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for "FROM electors" or "electors" in server.ts...');
lines.forEach((line, index) => {
    const l = line.toLowerCase();
    if (l.includes('from electors') || (l.includes('electors') && l.includes('count'))) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
