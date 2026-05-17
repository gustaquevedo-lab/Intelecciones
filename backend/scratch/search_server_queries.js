const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'whatsappService.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Searching for "axios" in whatsappService.ts...');
lines.forEach((line, index) => {
    if (line.includes('axios')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
