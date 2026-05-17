const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Express Routes Scanner ---');
const routes = [];
lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('app.post(') || trimmed.startsWith('app.get(') || trimmed.startsWith('app.put(') || trimmed.startsWith('app.delete(')) {
        routes.push({ line: index + 1, content: trimmed });
    }
});

console.log(`Found ${routes.length} routes:`);
routes.forEach(r => console.log(`${r.line}: ${r.content}`));
