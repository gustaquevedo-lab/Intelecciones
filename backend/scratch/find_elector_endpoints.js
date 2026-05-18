const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'server.ts');
console.log('Reading server.ts at:', serverPath);
const content = fs.readFileSync(serverPath, 'utf-8');

const routes = [];
const routeRegex = /app\.(get|post|put|delete)\(\s*['"]([^'"]+)['"]/g;
let match;
while ((match = routeRegex.exec(content)) !== null) {
  routes.push({
    method: match[1].toUpperCase(),
    path: match[2],
    index: match.index
  });
}

const electorRoutes = routes.filter(r => 
  r.path.includes('elector') || 
  r.path.includes('padron') || 
  r.path.includes('search') || 
  r.path.includes('consulta') || 
  r.path.includes('capture')
);

console.log(`\nFound ${electorRoutes.length} elector/search/padron/capture routes:`);
console.table(electorRoutes.map(r => ({ Method: r.method, Path: r.path })));
