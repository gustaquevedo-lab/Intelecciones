const fs = require('fs');
const path = './frontend/src/pages/CoordinatorApp.tsx';
let content = fs.readFileSync(path, 'utf8');

const marker = ") : activeTab === 'support' ? (";
const startIdx = content.indexOf(marker);

if (startIdx !== -1) {
    const endIdx = content.indexOf(')}', startIdx);
    if (endIdx !== -1) {
        content = content.substring(0, endIdx) + ") : null}" + content.substring(endIdx + 2);
        fs.writeFileSync(path, content);
        console.log('Fix applied successfully');
    } else {
        console.log('End marker not found');
    }
} else {
    console.log('Start marker not found');
}
