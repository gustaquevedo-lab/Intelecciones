const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'SuperAdmin.tsx');
if (!fs.existsSync(filePath)) {
    console.error('File not found at:', filePath);
    process.exit(1);
}
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for render blocks containing "isLoading" or "loading" or spinner/Loader in SuperAdmin.tsx...');
lines.forEach((line, index) => {
    if (line.includes('isLoading') || line.includes('spinner') || line.includes('Loader') || line.includes('Cargando')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
