const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/server.ts');

try {
  const code = fs.readFileSync(filePath, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes("app.get") && line.includes("users")) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} catch (err) {
  console.error(err.message);
}
