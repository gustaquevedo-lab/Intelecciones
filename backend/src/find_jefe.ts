import db from './db';
const user = db.prepare("SELECT username, password FROM users WHERE username = 'jefe'").get();
console.log("USER JEFE:", user);
