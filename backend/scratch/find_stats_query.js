const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for app.get(\'/api/stats/summary\') inside server.ts...');
let startLine = -1;
lines.forEach((line, index) => {
    if (line.includes('app.get(\'/api/stats/summary\'')) {
        startLine = index;
    }
});

if (startLine !== -1) {
    console.log(`Found on line ${startLine + 1}:`);
    for (let i = startLine; i < startLine + 60; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} else {
    console.log('Not found!');
}
