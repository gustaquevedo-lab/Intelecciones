import db from '../src/db';

console.log("Dropping duplicate/redundant indexes...");

const dropStatements = [
  "DROP INDEX IF EXISTS idx_elector_captures_ci",
  "DROP INDEX IF EXISTS idx_elector_captures_coord",
  "DROP INDEX IF EXISTS idx_elector_captures_list",
  "DROP INDEX IF EXISTS idx_elector_captures_coord_light",
  "DROP INDEX IF EXISTS idx_whatsapp_messages_terminal"
];

for (const sql of dropStatements) {
  try {
    db.exec(sql);
    console.log(`Executed: ${sql}`);
  } catch (e: any) {
    console.error(`Error executing ${sql}:`, e.message);
  }
}

console.log("All duplicate indexes dropped.");
