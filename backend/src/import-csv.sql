-- 1. Clean old electors and voting locations while preserving captures
DELETE FROM electors WHERE ci NOT IN (SELECT DISTINCT elector_ci FROM elector_captures);
DELETE FROM voting_locations;

-- 2. Configure CSV mode for SQLite CLI
.mode csv

-- 3. Import voting locations (no headers in CSV)
.import backend/uploads/voting_locations.csv voting_locations

-- 4. Import electors (no headers in CSV)
.import backend/uploads/electors.csv electors

-- 5. Create temporary table for inhabilitados
CREATE TEMP TABLE temp_inhabilitados (ci TEXT PRIMARY KEY);

-- 6. Import inhabilitados CIs
.import backend/uploads/inhabilitados.csv temp_inhabilitados

-- 7. Update restricted electors from inhabilitados table
UPDATE electors SET inhabilitado = 1 WHERE ci IN (SELECT ci FROM temp_inhabilitados);

-- 8. Clean up temp table and optimize database size
DROP TABLE temp_inhabilitados;
VACUUM;
