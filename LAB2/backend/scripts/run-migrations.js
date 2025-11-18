const initSqlSchema = require("../sql-schema");

(async () => {
  try {
    await initSqlSchema();
    console.log("Migration finished.");
    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e.message || e);
    process.exit(2);
  }
})();
