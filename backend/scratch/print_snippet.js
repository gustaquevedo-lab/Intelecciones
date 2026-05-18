const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(serverPath, 'utf-8');

const targets = [
  "'/api/electors/:ci'",
  '"/api/electors/:ci"',
  "'/api/admin/electors/search'",
  '"/api/admin/electors/search"'
];

for (const target of targets) {
  const index = content.indexOf(target);
  if (index !== -1) {
    console.log(`\n========================================`);
    console.log(`FOUND TARGET: ${target}`);
    console.log(`========================================`);
    console.log(content.slice(index - 10, index + 800));
  }
}
