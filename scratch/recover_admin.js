const fs = require('fs');
const logPath = 'C:\\Users\\Gustavo\\.gemini\\antigravity\\brain\\2d35e716-576c-42bd-9e21-76e088e2a189\\.system_generated\\logs\\overview.txt';
const logContent = fs.readFileSync(logPath, 'utf8');
const lines = logContent.split('\n');

// Find the line that wrote SuperAdmin.tsx with the longest content (the original create)
let targetLine = '';
for (const line of lines) {
    if (line.includes('SuperAdmin.tsx') && line.includes('write_to_file') && line.length > 10000) {
        if (!targetLine || line.length > targetLine.length) {
            targetLine = line;
        }
    }
}

if (!targetLine) {
    console.error('Could not find a suitable log line');
    process.exit(1);
}

const json = JSON.parse(targetLine);
let code = json.tool_calls[0].args.CodeContent;

// Unescape if necessary
if (code.startsWith('"')) {
    try {
        code = JSON.parse(code);
    } catch (e) {
        console.log('Manual unescape fallback');
        code = code.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
    }
}

fs.writeFileSync('C:\\Users\\Gustavo\\OneDrive\\Dev\\Intelecciones\\frontend\\src\\pages\\SuperAdmin_recovered.tsx', code);
console.log('Recovery complete. File size:', code.length);
