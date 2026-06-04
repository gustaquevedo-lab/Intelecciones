const fs = require('fs');
const path = require('path');

const targets = ['7424600', '7170676'];
const files = [
  'intellecciones.db',
  'recovered_intellecciones.db',
  'temp_db_95b.db'
];

for (const file of files) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${file}`);
    continue;
  }
  console.log(`\nScanning raw binary bytes of ${file} (${fs.statSync(fullPath).size} bytes)...`);
  try {
    const data = fs.readFileSync(fullPath);
    for (const target of targets) {
      const bufTarget = Buffer.from(target, 'utf-8');
      let index = -1;
      let count = 0;
      while ((index = data.indexOf(bufTarget, index + 1)) !== -1) {
        count++;
        // Print surrounding context
        const start = Math.max(0, index - 50);
        const end = Math.min(data.length, index + 150);
        const context = data.slice(start, end);
        console.log(`  Target '${target}' found at byte ${index} (Match #${count}):`);
        console.log(`    Context Hex: ${context.toString('hex')}`);
        // clean up ASCII string to only printable characters
        const ascii = context.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
        console.log(`    Context ASCII: ${ascii}`);
      }
      console.log(`  Total matches for '${target}' in ${file}: ${count}`);
    }
  } catch (e) {
    console.error(`Error scanning ${file}:`, e.message);
  }
}
