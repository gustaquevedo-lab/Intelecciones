const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('--- ROUTE ENDPOINTS ---');
lines.forEach((line, index) => {
    if (line.includes('app.get(') || line.includes('app.post(') || line.includes('app.put(') || line.includes('app.delete(')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
