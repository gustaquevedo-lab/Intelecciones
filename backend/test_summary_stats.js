const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

console.log("=== TESTING STATS/SUMMARY QUERIES WITH PARAMETERS ===");

function runTest(campaignId) {
  console.log(`\n--- Running test for campaign_id: ${campaignId} ---`);
  
  // Simulate getSecurityFilter results for CONCEPCION
  const district = 'CONCEPCION';
  const secU = {
    sql: " AND (u.distrito = ? OR EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?))",
    params: [district, district, district]
  };
  const secC = {
    sql: " AND c.distrito = ?",
    params: [district]
  };
  const secL = {
    sql: " AND l.ciudad = ?",
    params: [district]
  };
  const secE = {
    sql: " AND (e.ciudad = ? OR e.distrito = ?)",
    params: [district, district]
  };
  const secEC = {
    sql: " AND (e.ciudad = ? OR e.distrito = ?)",
    params: [district, district]
  };

  const cid = campaignId && !isNaN(parseInt(campaignId)) ? parseInt(campaignId) : null;

  let campFilterU = '';
  let campFilterC = '';
  let campFilterL = '';
  let campFilterE = '';
  let campFilterEC = '';

  const paramsU = [...secU.params];
  const paramsC = [...secC.params];
  const paramsL = [...secL.params];
  const paramsE = [...secE.params];
  const paramsEC = [...secEC.params];

  if (cid !== null) {
    campFilterU = ' AND u.assigned_campaign_id = ?';
    paramsU.push(cid);

    campFilterC = ' AND c.id = ?';
    paramsC.push(cid);

    campFilterL = ' AND l.campaign_id = ?';
    paramsL.push(cid);

    campFilterE = ' AND e.campaign_id = ?';
    paramsE.push(cid);

    campFilterEC = ' AND ec.campaign_id = ?';
    paramsEC.push(cid);
  }

  try {
    const usersCount = db.prepare(`SELECT COUNT(*) as count FROM users u WHERE 1=1 ${secU.sql}${campFilterU}`).get(...paramsU);
    const campaignsCount = db.prepare(`SELECT COUNT(*) as count FROM campaigns c WHERE 1=1 ${secC.sql}${campFilterC}`).get(...paramsC);
    const listsCount = db.prepare(`SELECT COUNT(*) as count FROM lists l WHERE 1=1 ${secL.sql}${campFilterL}`).get(...paramsL);
    const electorsCountVal = db.prepare(`SELECT COUNT(*) as count FROM electors e WHERE 1=1 ${secE.sql}${campFilterE}`).get(...paramsE);

    let query = `
      SELECT 
        COUNT(*) as captures,
        SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as transportNeeded,
        SUM(CASE WHEN ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) as transportAssigned,
        SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
        SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
        SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
        SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple
      FROM elector_captures ec
    `;

    if (secEC.sql.includes('e.ciudad') || secEC.sql.includes('e.distrito') || secEC.sql.includes('e.ci')) {
      query += ` LEFT JOIN electors e ON ec.elector_ci = e.ci WHERE 1=1 ${secEC.sql}`;
    } else {
      query += ` WHERE 1=1 ${secEC.sql.replace(/\be\./g, 'ec.')}`;
    }
    
    query += campFilterEC;
    const capturesStats = db.prepare(query).get(...paramsEC);

    console.log("SUCCESS! Stats retrieved:");
    console.log({
      users: usersCount.count,
      campaigns: campaignsCount.count,
      lists: listsCount.count,
      electors: electorsCountVal.count,
      captures: capturesStats.captures,
      transportNeeded: capturesStats.transportNeeded,
      green: capturesStats.green,
      yellow: capturesStats.yellow,
      red: capturesStats.red,
      purple: capturesStats.purple
    });
  } catch (e) {
    console.error("Test FAILED:", e.message);
  }
}

// Run with no campaign filter
runTest(null);

// Run with campaign ID 3 (Concepcion)
runTest('3');

// Run with non-existent campaign ID 999
runTest('999');
