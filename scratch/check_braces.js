const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Gustavo\\OneDrive\\Dev\\Intelecciones\\frontend\\src\\pages\\SuperAdmin.tsx', 'utf8');
let balance = 0;
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    for (let char of lines[i]) {
        if (char === '{') balance++;
        if (char === '}') balance--;
    }
    if (balance < 0) {
        console.log(`Negative balance at line ${i + 1}: ${balance}`);
    }
}
console.log(`Final balance: ${balance}`);
