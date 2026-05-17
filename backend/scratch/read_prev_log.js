const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Gustavo Quevedo\\.gemini\\antigravity\\brain\\82b7a688-8491-4441-a422-f62e672b73f6\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
  console.error("Log file does not exist at:", logPath);
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
console.log("Log size:", content.length, "bytes");

// Find all occurrences of temp_db_95b.db and show 500 characters around them
let pos = 0;
let matchCount = 0;
while (true) {
  const idx = content.indexOf('temp_db_95b.db', pos);
  if (idx === -1) break;
  matchCount++;
  console.log(`\n--- Match #${matchCount} at index ${idx} ---`);
  console.log(content.substring(Math.max(0, idx - 200), Math.min(content.length, idx + 800)));
  console.log("-------------------------------------------------------");
  pos = idx + 1;
}
