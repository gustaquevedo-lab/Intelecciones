console.log('1. Importing path...');
const path = require('path');
console.log('Path imported.');

console.log('2. Importing fs...');
const fs = require('fs');
console.log('Fs imported.');

console.log('3. Importing qrcode...');
const qrcode = require('qrcode');
console.log('Qrcode imported.');

console.log('4. Importing axios...');
const axios = require('axios');
console.log('Axios imported.');

console.log('5. Importing db...');
const db = require('../dist/db');
console.log('Db imported.');

console.log('All individual imports loaded successfully! No hangs.');
process.exit(0);
