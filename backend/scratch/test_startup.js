console.log('1. Starting diagnostic startup...');
const path = require('path');

console.log('2. Importing better-sqlite3...');
const Database = require('better-sqlite3');

console.log('3. Loading db module...');
const db = require('../dist/db');
console.log('3. db module loaded successfully.');

console.log('4. Loading whatsappService module (with lazy loading)...');
const ws = require('../dist/whatsappService');
console.log('4. whatsappService module loaded successfully.');

console.log('5. Loading express and starting express initialization...');
const express = require('express');
const app = express();
console.log('5. Express initialized.');

console.log('Diagnostic finished successfully! No hangs found.');
process.exit(0);
