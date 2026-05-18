const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Searching for 'my-team' or 'reports' in server.ts...");
lines.forEach((line, index) => {
  if (line.includes('my-team') || line.includes('reports')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
