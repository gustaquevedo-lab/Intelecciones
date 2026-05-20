const Database = require('better-sqlite3');
const db = new Database(':memory:');

// Create temporary users table mimicking the production database schema
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    role TEXT,
    nombre TEXT,
    parent_id INTEGER,
    assigned_campaign_id INTEGER
  );
`);

// Mocked version of canModifyUser utilizing our local in-memory db
const canModifyUser = (requesterId, requesterRole, targetUserId) => {
  const reqRole = requesterRole.toUpperCase().trim();
  if (reqRole === 'SUPERUSUARIO' || reqRole === 'SUPER_ADMIN') {
    return true;
  }
  if (!requesterId) return false;

  const reqId = Number(requesterId);
  const targetId = Number(targetUserId);

  if (reqId === targetId) return true;

  try {
    const target = db.prepare('SELECT role, parent_id, assigned_campaign_id FROM users WHERE id = ?').get(targetId);
    if (!target) return false;

    // Direct parent sovereignty: direct creator has editing rights
    if (target.parent_id === reqId) return true;

    // Subjefe hierarchy: can edit if target's parent is a PADRINO and that PADRINO's parent is the requester
    if (reqRole === 'SUBJEFE') {
      if (target.parent_id) {
        const parent = db.prepare('SELECT role, parent_id FROM users WHERE id = ?').get(target.parent_id);
        if (parent && parent.role === 'PADRINO' && parent.parent_id === reqId) {
          return true;
        }
      }
    }

    // Jefe de Campaña hierarchy: can edit if target's parent is a PADRINO and that PADRINO's parent is the requester
    if (reqRole === 'JEFE_CAMPANA' || reqRole === 'CANDIDATO') {
      if (target.parent_id) {
        const parent = db.prepare('SELECT role, parent_id FROM users WHERE id = ?').get(target.parent_id);
        if (parent && parent.role === 'PADRINO' && parent.parent_id === reqId) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error('Error in canModifyUser check:', err);
    return false;
  }
};

// Seed test users:
// 1. Jefe de Campaña (ID: 1)
// 2. Subjefe created by Jefe (ID: 2)
// 3. Padrino A created by Jefe (ID: 3)
// 4. Coordinator A created by Padrino A (ID: 4)
// 5. Padrino B created by Subjefe (ID: 5)
// 6. Coordinator B created by Padrino B (ID: 6)

db.prepare("INSERT INTO users (id, username, role, nombre, parent_id, assigned_campaign_id) VALUES (1, 'jefe', 'JEFE_CAMPANA', 'Jefe de Campaña', NULL, 1)").run();
db.prepare("INSERT INTO users (id, username, role, nombre, parent_id, assigned_campaign_id) VALUES (2, 'subjefe', 'SUBJEFE', 'Subjefe', 1, 1)").run();
db.prepare("INSERT INTO users (id, username, role, nombre, parent_id, assigned_campaign_id) VALUES (3, 'padrinoA', 'PADRINO', 'Padrino A', 1, 1)").run();
db.prepare("INSERT INTO users (id, username, role, nombre, parent_id, assigned_campaign_id) VALUES (4, 'coordA', 'COORDINADOR', 'Coordinador A', 3, 1)").run();
db.prepare("INSERT INTO users (id, username, role, nombre, parent_id, assigned_campaign_id) VALUES (5, 'padrinoB', 'PADRINO', 'Padrino B', 2, 1)").run();
db.prepare("INSERT INTO users (id, username, role, nombre, parent_id, assigned_campaign_id) VALUES (6, 'coordB', 'Coordinador B', 'Coordinador B', 5, 1)").run();

// Assertions to verify the user hierarchy rules
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
};

console.log("Starting sovereignty validation tests...");

// Rule 1: Users can edit themselves
assert(canModifyUser(1, 'JEFE_CAMPANA', 1) === true, "Jefe can edit themselves");
assert(canModifyUser(2, 'SUBJEFE', 2) === true, "Subjefe can edit themselves");

// Rule 2: Jefe de Campaña has sovereignty over direct descendants (Subjefe they created, Padrino A they created)
assert(canModifyUser(1, 'JEFE_CAMPANA', 2) === true, "Jefe can edit Subjefe they created");
assert(canModifyUser(1, 'JEFE_CAMPANA', 3) === true, "Jefe can edit Padrino A they created");

// Rule 3: Jefe de Campaña CANNOT edit Padrino B created by Subjefe
assert(canModifyUser(1, 'JEFE_CAMPANA', 5) === false, "Jefe CANNOT edit Padrino B created by Subjefe");

// Rule 4: Jefe de Campaña has sovereignty over Coordinator A under Padrino A (since Padrino A was created by Jefe)
assert(canModifyUser(1, 'JEFE_CAMPANA', 4) === true, "Jefe can edit Coordinator A (under Padrino A created by Jefe)");

// Rule 5: Jefe de Campaña CANNOT edit Coordinator B under Padrino B (since Padrino B was created by Subjefe)
assert(canModifyUser(1, 'JEFE_CAMPANA', 6) === false, "Jefe CANNOT edit Coordinator B (under Padrino B created by Subjefe)");

// Rule 6: Subjefe has sovereignty over Padrino B they created
assert(canModifyUser(2, 'SUBJEFE', 5) === true, "Subjefe can edit Padrino B they created");

// Rule 7: Subjefe has sovereignty over Coordinator B under Padrino B
assert(canModifyUser(2, 'SUBJEFE', 6) === true, "Subjefe can edit Coordinator B (under Padrino B created by Subjefe)");

// Rule 8: Subjefe CANNOT edit Padrino A (created by Jefe)
assert(canModifyUser(2, 'SUBJEFE', 3) === false, "Subjefe CANNOT edit Padrino A created by Jefe");

// Rule 9: Subjefe CANNOT edit Coordinator A (under Padrino A created by Jefe)
assert(canModifyUser(2, 'SUBJEFE', 4) === false, "Subjefe CANNOT edit Coordinator A (under Padrino A created by Jefe)");

console.log("\nAll hierarchy security checks completed successfully!");
