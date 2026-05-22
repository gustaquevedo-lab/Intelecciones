const fs = require('fs');

const data = fs.readFileSync('Reporte coordinadores ramon ferreira.pdf');
const str = data.toString('binary');
let pos = 0;
let count = 0;
while (true) {
  const idx = str.indexOf('/Type /XObject', pos);
  if (idx === -1) break;
  count++;
  // print the surrounding dictionary (e.g. 50 characters before and after)
  const start = Math.max(0, idx - 100);
  const end = Math.min(str.length, idx + 100);
  console.log(`XObject ${count} surrounding text:`);
  console.log(str.slice(start, end).replace(/[\r\n]+/g, ' '));
  console.log('--------------------------------------------------');
  pos = idx + 14;
}
