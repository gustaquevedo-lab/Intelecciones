
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'backend', 'intellecciones.db');
const db = new Database(dbPath);

const lists = db.prepare('SELECT id, candidate_nombre, photo_url FROM lists LIMIT 5').all();
console.log('List Photos:', JSON.stringify(lists, null, 2));

const users = db.prepare('SELECT id, nombre, photo_url FROM users LIMIT 5').all();
console.log('User Photos:', JSON.stringify(users, null, 2));
