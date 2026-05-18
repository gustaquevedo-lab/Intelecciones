const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Searching for 'getDistrict' in server.ts...");
lines.forEach((line, index) => {
  if (line.includes('const getDistrict') || line.includes('function getDistrict')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print next 20 lines
    for (let i = 1; i <= 20; i++) {
      console.log(`Line ${index + 1 + i}: ${lines[index + i]}`);
    }
  }
});
