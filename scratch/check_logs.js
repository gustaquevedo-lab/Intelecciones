const fs = require('fs');
const logPath = 'C:\\Users\\Gustavo\\.gemini\\antigravity\\brain\\2d35e716-576c-42bd-9e21-76e088e2a189\\.system_generated\\logs\\overview.txt';
const logContent = fs.readFileSync(logPath, 'utf8');
const lines = logContent.split('\n');

console.log('Total lines:', lines.length);
let count = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('SuperAdmin.tsx') && line.includes('write_to_file')) {
        console.log(`Line ${i+1}: length ${line.length}`);
        count++;
    }
}
console.log('Matches found:', count);
