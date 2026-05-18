const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Searching for 'function getSecurityFilter' in server.ts...");
lines.forEach((line, index) => {
  if (line.includes('function getSecurityFilter') || line.includes('const getSecurityFilter')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print next 50 lines
    for (let i = 1; i <= 60; i++) {
      console.log(`Line ${index + 1 + i}: ${lines[index + i]}`);
    }
  }
});
