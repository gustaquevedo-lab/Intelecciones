const { syncDistrito } = require('../dist/services/tsjeSync');

console.log("Starting syncDistrito(45, 13, 0)...");
syncDistrito(45, 13, 0, { rateLimitMs: 100 })
  .then(res => {
    console.log("Sync completed successfully!");
    console.log(res);
  })
  .catch(err => {
    console.error("Sync failed:", err);
  });
