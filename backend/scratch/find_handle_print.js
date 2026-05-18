const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'TeamPanel.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Searching for 'handlePrint' in TeamPanel.tsx...");
lines.forEach((line, index) => {
  if (line.includes('const handlePrint') || line.includes('function handlePrint')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print next 25 lines
    for (let i = 1; i <= 25; i++) {
      console.log(`Line ${index + 1 + i}: ${lines[index + i]}`);
    }
  }
});
