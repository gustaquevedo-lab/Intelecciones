import db from '../src/db';
import { normalizePhone } from '../src/utils/phone';

console.log("Starting backfill for phone_hash in users and elector_captures...");

try {
  // 1. Backfill users
  const users = db.prepare("SELECT id, telefono FROM users WHERE telefono IS NOT NULL AND (phone_hash IS NULL OR phone_hash = '')").all() as any[];
  console.log(`Found ${users.length} users needing phone_hash backfill.`);
  
  if (users.length > 0) {
    const updateUser = db.prepare("UPDATE users SET phone_hash = ? WHERE id = ?");
    db.transaction(() => {
      for (const u of users) {
        updateUser.run(normalizePhone(u.telefono), u.id);
      }
    })();
    console.log(`Successfully backfilled ${users.length} users.`);
  }

  // 2. Backfill elector_captures
  const captures = db.prepare("SELECT id, telefono FROM elector_captures WHERE telefono IS NOT NULL AND (phone_hash IS NULL OR phone_hash = '')").all() as any[];
  console.log(`Found ${captures.length} elector_captures needing phone_hash backfill.`);

  if (captures.length > 0) {
    const updateCapture = db.prepare("UPDATE elector_captures SET phone_hash = ? WHERE id = ?");
    db.transaction(() => {
      for (const c of captures) {
        updateCapture.run(normalizePhone(c.telefono), c.id);
      }
    })();
    console.log(`Successfully backfilled ${captures.length} elector_captures.`);
  }
  
  console.log("Backfill completed successfully.");
} catch (e: any) {
  console.error("Error during backfill:", e.message);
  process.exit(1);
}
