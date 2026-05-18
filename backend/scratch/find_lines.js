const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'server.ts');
const lines = fs.readFileSync(serverPath, 'utf-8').split('\n');

const targets = [
  '/api/admin/electors/search',
  '/api/electors/:ci',
  '/api/offline/padron'
];

targets.forEach(target => {
  lines.forEach((line, index) => {
    if (line.includes(target)) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
});
