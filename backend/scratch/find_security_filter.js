const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for getSecurityFilter inside server.ts...');
let startLine = -1;
lines.forEach((line, index) => {
    if (line.includes('const getSecurityFilter =')) {
        startLine = index;
    }
});

if (startLine !== -1) {
    console.log(`Found on line ${startLine + 1}:`);
    for (let i = startLine; i < startLine + 100; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} else {
    console.log('Not found!');
}
