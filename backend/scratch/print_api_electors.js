const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(serverPath, 'utf-8');

const target = "app.get('/api/electors'";
const index = content.indexOf(target);
if (index !== -1) {
  console.log('FOUND:', target);
  console.log(content.slice(index, index + 800));
} else {
  console.log('NOT FOUND exact match. Let us search for "/api/electors"');
  const idx2 = content.indexOf('"/api/electors"');
  const idx3 = content.indexOf("'/api/electors'");
  if (idx2 !== -1) console.log('FOUND 2:', content.slice(idx2, idx2 + 800));
  if (idx3 !== -1) console.log('FOUND 3:', content.slice(idx3, idx3 + 800));
}
