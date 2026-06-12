const fs = require('fs');
const content = fs.readFileSync('src/routes/diad.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('router.get(') || line.includes('router.post(')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
