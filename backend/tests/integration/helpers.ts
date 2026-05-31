import db, { runBootstrapChecks } from '../../src/db';
import { app } from '../../src/server';

export { app };

export const setupTestDB = () => {
  // Limpiar todas las tablas para asegurar el aislamiento de las pruebas
  db.exec('DELETE FROM elector_captures');
  db.exec('DELETE FROM capture_conflicts');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM lists');
  db.exec('DELETE FROM campaigns');
  db.exec('DELETE FROM electors');
  db.exec('DELETE FROM participation_logs');
  db.exec('DELETE FROM results');
  db.exec('DELETE FROM acta_results');
  db.exec('DELETE FROM field_requests');
  db.exec('DELETE FROM settings');

  // Ejecutar validaciones iniciales de base de datos
  runBootstrapChecks();
};

export const seedTestData = () => {
  // 1. Insertar campaña de prueba
  db.prepare(`
    INSERT INTO campaigns (id, name, enabled_modules, status, slogan, distrito, goal)
    VALUES (1, 'Campaña Test', 'COMMAND_CENTER,REGISTRY', 'active', 'Slogan Test', 'TEST_DISTRICT', 100)
  `).run();

  // 2. Insertar lista de prueba
  db.prepare(`
    INSERT INTO lists (id, campaign_id, type, list_number, option_number, candidate_ci, candidate_nombre, candidate_alias, goal, is_adversary)
    VALUES (1, 1, 'CONCEJALES', '3', '1', '1234567', 'Candidato Test', 'Ali Test', 50, 0)
  `).run();

  // 3. Insertar usuarios de prueba (Superusuario, Padrino, Coordinador)
  db.prepare(`
    INSERT INTO users (id, username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, status)
    VALUES (1, 'admin', 'admin123', 'SUPERUSUARIO', NULL, 1, 'Administrador Test', 'TEST_DISTRICT', '1111111', 'ACTIVE')
  `).run();

  db.prepare(`
    INSERT INTO users (id, username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, status, parent_id)
    VALUES (2, 'padrino', 'padrino123', 'PADRINO', 1, 1, 'Padrino Test', 'TEST_DISTRICT', '2222222', 'ACTIVE', 1)
  `).run();

  db.prepare(`
    INSERT INTO users (id, username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, status, parent_id)
    VALUES (3, 'coordinador', 'coord123', 'COORDINADOR', 1, 1, 'Coordinador Test', 'TEST_DISTRICT', '3333333', 'ACTIVE', 2)
  `).run();

  // 4. Insertar elector de prueba en el padrón
  db.prepare(`
    INSERT INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, ciudad, distrito, campaign_id)
    VALUES ('4444444', 'Elector', 'Prueba', 'Colegio Nacional Test', 5, 12, 'TEST_CITY', 'TEST_DISTRICT', 1)
  `).run();
};
