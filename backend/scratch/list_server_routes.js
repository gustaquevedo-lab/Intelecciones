const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Registered routes in server.ts:");
lines.forEach((line, index) => {
  if (line.includes('app.get(') || line.includes('app.post(') || line.includes('app.use(')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
