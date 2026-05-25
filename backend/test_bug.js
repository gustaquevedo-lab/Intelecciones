const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

const role = 'JEFE_CAMPANA';
const selectedDistrict = 'CONCEPCION';
const selectedPadrino = 'ALL';
const selectedList = 'ALL';
const requesterId = '7';

// getDistrict = null (for ALL)
// getSecurityFilter for JEFE_CAMPANA with user.distrito = 'CONCEPCION'
const filterE = {
  sql: ` AND (
    u.distrito = ? OR 
    EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
    EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
  )`,
  params: ['CONCEPCION', 'CONCEPCION', 'CONCEPCION']
};

const needsUsersJoin = false; // as calculated by: role === 'PADRINO' (false) || selectedPadrino !== 'ALL' (false) || (role !== 'SUPERUSUARIO' && false)

const needsListsJoin = false;

let q1_ids = `
  SELECT ec.id, ec.timestamp
  FROM electors e INDEXED BY idx_electors_distrito
  INNER JOIN elector_captures ec ON ec.elector_ci = e.ci
  ${needsUsersJoin ? 'LEFT JOIN users u ON ec.coordinator_id = u.id' : ''}
  ${needsListsJoin ? 'LEFT JOIN lists l ON ec.list_id = l.id' : ''}
  WHERE e.distrito = ?
`;

let extraFilters = ` ${filterE.sql}`;
q1_ids += extraFilters;

try {
  console.log("Executing buggy query...");
  db.prepare(q1_ids).all(selectedDistrict, ...filterE.params);
  console.log("SUCCESS (no bug)");
} catch (e) {
  console.error("BUG DETECTED:", e.message);
}
