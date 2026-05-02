const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Gustavo\\OneDrive\\Dev\\Intelecciones\\frontend\\src\\pages\\SuperAdmin_recovered.tsx', 'utf8');

let code = content;
if (code.startsWith('"')) {
    code = JSON.parse(code);
}

fs.writeFileSync('C:\\Users\\Gustavo\\OneDrive\\Dev\\Intelecciones\\frontend\\src\\pages\\SuperAdmin_recovered.tsx', code);
console.log('Fixed SuperAdmin_recovered.tsx');
