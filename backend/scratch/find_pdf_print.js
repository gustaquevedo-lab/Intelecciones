const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'TeamPanel.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Searching for 'pdf', 'print', or 'export' in TeamPanel.tsx...");
lines.forEach((line, index) => {
  if (line.includes('pdf') || line.includes('print') || line.includes('download') || line.includes('PDF')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
