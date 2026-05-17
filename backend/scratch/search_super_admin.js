const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'SuperAdmin.tsx');
if (!fs.existsSync(filePath)) {
    console.error('File not found at:', filePath);
    process.exit(1);
}
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for API requests and loading in SuperAdmin.tsx...');
lines.forEach((line, index) => {
    const l = line.toLowerCase();
    if (l.includes('api.') || l.includes('loading') || l.includes('fetch') || l.includes('/users') || l.includes('wait')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
