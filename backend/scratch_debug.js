
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'intellecciones.db');
const db = new Database(dbPath);

console.log("--- DIAGNÓSTICO DE BASE DE DATOS ---");

const electorDistritos = db.prepare("SELECT DISTINCT distrito, ciudad FROM electors LIMIT 10").all();
console.log("Distritos/Ciudades en ELECTORS:", electorDistritos);

const listDistritos = db.prepare("SELECT DISTINCT ciudad FROM lists LIMIT 10").all();
console.log("Ciudades en LISTS:", listDistritos);

const captureCount = db.prepare("SELECT COUNT(*) as total FROM elector_captures").get();
console.log("Total Capturas:", captureCount);

const sampleCaptures = db.prepare(`
    SELECT ec.id, e.distrito, e.ciudad, ec.list_id 
    FROM elector_captures ec 
    JOIN electors e ON ec.elector_ci = e.ci 
    LIMIT 5
`).all();
console.log("Muestra de Capturas con sus Distritos:", sampleCaptures);

const pjCaptures = db.prepare(`
    SELECT COUNT(*) as count 
    FROM elector_captures ec 
    JOIN electors e ON ec.elector_ci = e.ci 
    WHERE UPPER(e.distrito) = 'PEDRO JUAN CABALLERO' OR UPPER(e.ciudad) = 'PEDRO JUAN CABALLERO'
`).get();
console.log("Capturas en PEDRO JUAN CABALLERO:", pjCaptures);
