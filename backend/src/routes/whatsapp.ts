import { Router } from 'express';
import multer from 'multer';
import db from '../db';
import { whatsappService } from '../whatsappService';
import { normalizePhone } from '../utils/phone';
import {
  getCachedUserInfo, getRole, getSecurityFilter, getListId,
  sanitizeElectorData, addSubtleVariation
} from './helpers';
import { broadcastLimiter } from '../server';

export default function whatsappRoutes(storage: multer.StorageEngine) {
  const router = Router();

  const whatsappUpload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }
  });

  router.post('/upload', whatsappUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.json({
      success: true,
      url: `${baseUrl}/uploads/${req.file.filename}`,
      path: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      mimetype: req.file.mimetype
    });
  });

  router.get('/terminals', async (req, res) => {
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const campaignId = (user?.role === 'SUPERUSUARIO') ? null : user?.campaign_id;
    res.json(await whatsappService.getTerminals(campaignId));
  });

  router.post('/terminals', async (req, res) => {
    const { id, name } = req.body;
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const campaignId = user?.campaign_id || null;
    await whatsappService.addTerminal(id, name, campaignId);
    res.json({ success: true });
  });

  router.get('/status', (req, res) => {
    const terminalId = (req.query.terminalId as string) || 'default';
    res.json(whatsappService.getStatus(terminalId));
  });

  router.post('/connect', (req, res) => {
    const terminalId = (req.body.terminalId as string) || 'default';
    const status = whatsappService.getStatus(terminalId);
    if (!status) return res.status(404).json({ error: `Terminal "${terminalId}" no encontrada. Créala primero.` });
    if (status.status === 'CONNECTED') return res.json({ success: true, status: 'CONNECTED', message: 'Ya conectada' });
    if (status.status === 'CONNECTING') return res.json({ success: true, status: 'CONNECTING', message: 'Ya iniciando conexión', qr: status.qr });
    whatsappService.connect(terminalId);
    res.json({ success: true, status: 'CONNECTING', message: 'Iniciando conexión WhatsApp...' });
  });

  router.post('/disconnect', (req, res) => {
    const terminalId = (req.body.terminalId as string) || 'default';
    whatsappService.disconnect(terminalId);
    res.json({ success: true });
  });

  router.post('/terminals/:id/warmup', (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body;
    try {
      db.prepare('UPDATE whatsapp_terminals SET warmup_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
      // Update in-memory cache if it exists
      const status = whatsappService.getStatus(id);
      if (status) {
        status.warmup_enabled = enabled ? 1 : 0;
      }
      res.json({ success: true, warmup_enabled: enabled ? 1 : 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/templates', (req, res) => {
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const role = getRole(req);
    try {
      let sql = 'SELECT * FROM whatsapp_templates WHERE 1=1';
      const params: any[] = [];
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
        sql += ' AND (campaign_id = ? OR campaign_id IS NULL)';
        params.push(user.campaign_id);
      }
      sql += ' ORDER BY created_at DESC';
      const templates = db.prepare(sql).all(...params);
      res.json(templates);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/templates', (req, res) => {
    const { name, content, media_url, media_type, lat, lng, contact_name, contact_phone } = req.body;
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const campaignId = user?.campaign_id || null;
    try {
      const result = db.prepare(`
        INSERT INTO whatsapp_templates (name, content, media_url, media_type, lat, lng, contact_name, contact_phone, campaign_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, content, media_url, media_type, lat, lng, contact_name, contact_phone, campaignId);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/templates/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM whatsapp_templates WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/broadcast/logs', (req, res) => {
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const role = getRole(req);
    try {
      let sql = `
        SELECT l.*, t.name as template_name
        FROM whatsapp_broadcast_logs l
        LEFT JOIN whatsapp_templates t ON l.template_id = t.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
        sql += ' AND l.campaign_id = ?';
        params.push(user.campaign_id);
      }
      sql += ' ORDER BY l.timestamp DESC LIMIT 50';
      const logs = db.prepare(sql).all(...params);
      res.json(logs);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/broadcast', broadcastLimiter, async (req, res) => {
    const {
      template_id, targets, message, media_url, media_type,
      minDelay = 2, maxDelay = 5, useSpintax = true, terminalId: reqTerminalId
    } = req.body;

    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const campaignId = user?.campaign_id || null;
    const rotateTerminals = reqTerminalId === 'rotate' || req.body.rotateTerminals === true;
    const terminalId = rotateTerminals ? 'rotate' : (reqTerminalId || 'default');
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });

    try {
      if (!targets || !Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ error: 'No se encontraron destinatarios con teléfono' });
      }

      const activeTerminals = (await whatsappService.getTerminals(campaignId))
        .filter(t => t.status === 'CONNECTED');

      if (rotateTerminals && activeTerminals.length === 0) {
        return res.status(400).json({ error: 'No hay terminales activas de WhatsApp conectadas para rotar.' });
      }

      const logResult = db.prepare(`
        INSERT INTO whatsapp_broadcast_logs (template_id, custom_message, media_url, media_type, terminal_id, target_count, status, min_delay, max_delay, campaign_id)
        VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?, ?)
      `).run(template_id || null, message || null, media_url || null, media_type || null, terminalId, targets.length, minDelay, maxDelay, campaignId);
      const logId = logResult.lastInsertRowid;

      const runBroadcast = async () => {
        const { canSendMore, getSmartDelay, incrementDailyCount, isGoodSendingHour } = require('../whatsappRateLimiter');
        const { isOptedOut } = require('../whatsappAutoresponder');

        let successCount = 0;
        let failCount = 0;
        let sentInSession = 0;

        for (let i = 0; i < targets.length; i++) {
          const log = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
          if (!log) break;
          if (log.status === 'CANCELLED') break;
          if (log.status === 'PAUSED') { await new Promise(r => setTimeout(r, 2000)); i--; continue; }

          let currentTerminalId = terminalId;
          if (rotateTerminals && activeTerminals.length > 0) {
            currentTerminalId = activeTerminals[sentInSession % activeTerminals.length].id;
          }

          const rateCheck = canSendMore(currentTerminalId);
          if (!rateCheck.allowed) {
            console.log(`[BROADCAST ${logId}] Rate limit hit for ${currentTerminalId}: ${rateCheck.reason}`);
            if (rotateTerminals && activeTerminals.length > 1) {
              const idx = activeTerminals.findIndex((t: any) => t.id === currentTerminalId);
              if (idx !== -1) activeTerminals.splice(idx, 1);
              if (activeTerminals.length === 0) break;
              i--;
              continue;
            }
            break;
          }

          if (!isGoodSendingHour()) {
            await new Promise(r => setTimeout(r, 1800000));
            i--;
            continue;
          }

          const target = targets[i];
          if (!target.telefono) {
            failCount++;
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'Sin número de teléfono')`)
              .run(logId, target.telefono || '', target.nombre || '');
            continue;
          }

          if (isOptedOut(target.telefono)) {
            failCount++;
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'Usuario solicitó exclusión (Opt-out)')`)
              .run(logId, target.telefono, target.nombre || '');
            db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, logId);
            continue;
          }

          try {
            let personalizedContent = message || '';
            if (template_id) {
              const template = db.prepare('SELECT content FROM whatsapp_templates WHERE id = ?').get(template_id) as any;
              if (template?.content) personalizedContent = template.content;
            }

            personalizedContent = personalizedContent
              .replace(/{{nombre}}/g, target.nombre || 'Amigo/a')
              .replace(/{{ci}}/g, target.elector_ci || target.ci || '')
              .replace(/{{local}}/g, target.local_votacion || 'No especificado')
              .replace(/{{mesa}}/g, target.mesa?.toString() || '-')
              .replace(/{{orden}}/g, target.orden?.toString() || '-');

            if (useSpintax && personalizedContent) {
              personalizedContent = addSubtleVariation(personalizedContent);
            }

            if (media_type === 'VOICE' && media_url) {
              await whatsappService.sendVoice(currentTerminalId, target.telefono, media_url);
            } else if (media_url) {
              await whatsappService.sendMedia(currentTerminalId, target.telefono, media_url, personalizedContent);
            } else {
              await whatsappService.sendMessage(currentTerminalId, target.telefono, personalizedContent);
            }
            successCount++;
            sentInSession++;
            incrementDailyCount(currentTerminalId);
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status) VALUES (?, ?, ?, 'SENT')`)
              .run(logId, target.telefono, target.nombre || '');
          } catch (err: any) {
            failCount++;
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', ?)`)
              .run(logId, target.telefono, target.nombre || '', err?.message || 'Error desconocido');

            const errMsg = (err?.message || '').toLowerCase();
            if (errMsg.includes('banned') || errMsg.includes('blocked') || errMsg.includes('restrict') || errMsg.includes('403')) {
              db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ?, status = ? WHERE id = ?')
                .run(successCount, failCount, 'STOPPED_BAN_RISK', logId);
              return;
            }
          }

          db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, logId);
          if (i === targets.length - 1) break;
          const delayMs = getSmartDelay(currentTerminalId, sentInSession);
          await new Promise(r => setTimeout(r, delayMs));
        }

        const finalLog = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
        const finalStatus = (finalLog && (finalLog.status === 'CANCELLED' || finalLog.status === 'PAUSED')) ? finalLog.status : 'COMPLETED';
        db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ?, status = ? WHERE id = ?')
          .run(successCount, failCount, finalStatus, logId);
      };

      runBroadcast().catch(err => console.error('[BROADCAST] runBroadcast error:', err));
      res.json({ success: true, log_id: logId, target_count: targets.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/warmup-status', (req, res) => {
    const { getTerminalWarmupStatus } = require('../whatsappRateLimiter');
    try {
      const terminalIds = whatsappService.getTerminalIds();
      const statuses = terminalIds.map((id: string) => getTerminalWarmupStatus(id));
      res.json(statuses);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/broadcast/active', (req, res) => {
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    try {
      let sql = `SELECT id, target_count, success_count, fail_count, status FROM whatsapp_broadcast_logs WHERE status IN ('RUNNING', 'PAUSED')`;
      const params: any[] = [];
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) { sql += ' AND campaign_id = ?'; params.push(user.campaign_id); }
      sql += ' ORDER BY id DESC LIMIT 1';
      const active = db.prepare(sql).get(...params);
      res.json(active || null);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/broadcast/logs/:id', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const logId = parseInt(req.params.id);
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    try {
      const log = db.prepare(`SELECT l.*, t.name as template_name FROM whatsapp_broadcast_logs l LEFT JOIN whatsapp_templates t ON l.template_id = t.id WHERE l.id = ?`).get(logId) as any;
      if (!log) return res.status(404).json({ error: 'Log no encontrado' });
      if (role !== 'SUPERUSUARIO' && user?.campaign_id && log.campaign_id !== user.campaign_id) return res.status(403).json({ error: 'Prohibido' });
      res.json(log);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/broadcast/:id/pause', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const logId = parseInt(req.params.id);
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    try {
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
        const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
        if (log && log.campaign_id !== user.campaign_id) return res.status(403).json({ error: 'Prohibido' });
      }
      db.prepare("UPDATE whatsapp_broadcast_logs SET status = 'PAUSED' WHERE id = ?").run(logId);
      res.json({ success: true, status: 'PAUSED' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/broadcast/:id/resume', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const logId = parseInt(req.params.id);
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    try {
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
        const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
        if (log && log.campaign_id !== user.campaign_id) return res.status(403).json({ error: 'Prohibido' });
      }
      db.prepare("UPDATE whatsapp_broadcast_logs SET status = 'RUNNING' WHERE id = ?").run(logId);
      res.json({ success: true, status: 'RUNNING' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/broadcast/:id/cancel', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const logId = parseInt(req.params.id);
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    try {
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
        const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
        if (log && log.campaign_id !== user.campaign_id) return res.status(403).json({ error: 'Prohibido' });
      }
      db.prepare("UPDATE whatsapp_broadcast_logs SET status = 'CANCELLED' WHERE id = ?").run(logId);
      res.json({ success: true, status: 'CANCELLED' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/broadcast/:id/retry-failed', async (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const logId = parseInt(req.params.id);
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);

    try {
      const orig = db.prepare('SELECT * FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
      if (!orig) return res.status(404).json({ error: 'Log no encontrado' });
      if (role !== 'SUPERUSUARIO' && user?.campaign_id && orig.campaign_id && orig.campaign_id !== user.campaign_id) {
        return res.status(403).json({ error: 'Prohibido' });
      }

      const failedRows = db.prepare(
        `SELECT telefono, nombre FROM whatsapp_broadcast_recipients WHERE log_id = ? AND status = 'FAILED' AND telefono != ''`
      ).all(logId) as { telefono: string; nombre: string }[];

      if (failedRows.length === 0) return res.status(400).json({ error: 'No hay destinatarios fallidos para reintentar' });

      const origTerminalId = orig.terminal_id || 'default';
      const minDelay = orig.min_delay ?? 2;
      const maxDelay = orig.max_delay ?? 5;
      const rotateTerminals = origTerminalId === 'rotate';
      const activeTerminals = rotateTerminals
        ? (await whatsappService.getTerminals(orig.campaign_id)).filter(t => t.status === 'CONNECTED')
        : [];

      if (rotateTerminals && activeTerminals.length === 0) {
        return res.status(400).json({ error: 'No hay terminales activas de WhatsApp conectadas para rotar en el reintento.' });
      }

      const newLog = db.prepare(
        `INSERT INTO whatsapp_broadcast_logs (template_id, custom_message, media_url, media_type, terminal_id, target_count, status, min_delay, max_delay, campaign_id)
         VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?, ?)`
      ).run(orig.template_id || null, orig.custom_message || null, orig.media_url || null, orig.media_type || null,
            origTerminalId, failedRows.length, minDelay, maxDelay, orig.campaign_id || null);
      const newLogId = newLog.lastInsertRowid;

      const runRetry = async () => {
        let successCount = 0; let failCount = 0; let sentInSession = 0;
        for (let i = 0; i < failedRows.length; i++) {
          const log = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(newLogId) as any;
          if (!log || log.status === 'CANCELLED') break;
          while (log.status === 'PAUSED') { await new Promise(r => setTimeout(r, 1000)); }

          const target = failedRows[i];
          let currentTerminalId = origTerminalId;
          if (rotateTerminals && activeTerminals.length > 0) {
            currentTerminalId = activeTerminals[sentInSession % activeTerminals.length].id;
          }

          const { isOptedOut } = require('../whatsappAutoresponder');
          if (isOptedOut(target.telefono)) {
            failCount++;
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'Usuario solicitó exclusión (Opt-out)')`)
              .run(newLogId, target.telefono, target.nombre || '');
            db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, newLogId);
            continue;
          }

          try {
            const exists = await whatsappService.checkNumberExists(currentTerminalId, target.telefono);
            if (!exists) {
              failCount++;
              db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'El número no tiene WhatsApp registrado')`)
                .run(newLogId, target.telefono, target.nombre || '');
              db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, newLogId);
              continue;
            }
          } catch (err: any) {
            console.warn(`[RETRY] No se pudo verificar la existencia de WhatsApp para ${target.telefono}:`, err.message);
          }

          try {
            let content = orig.custom_message || '';
            if (orig.template_id) {
              const t = db.prepare('SELECT content FROM whatsapp_templates WHERE id = ?').get(orig.template_id) as any;
              if (t?.content) content = t.content;
            }
            content = addSubtleVariation(content.replace(/{{nombre}}/g, target.nombre || 'Amigo/a'));

            if (orig.media_type === 'VOICE' && orig.media_url) {
              await whatsappService.sendVoice(currentTerminalId, target.telefono, orig.media_url);
            } else if (orig.media_url) {
              await whatsappService.sendMedia(currentTerminalId, target.telefono, orig.media_url, content);
            } else {
              await whatsappService.sendMessage(currentTerminalId, target.telefono, content);
            }
            successCount++;
            sentInSession++;
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status) VALUES (?, ?, ?, 'SENT')`)
              .run(newLogId, target.telefono, target.nombre || '');
          } catch (err: any) {
            failCount++;
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', ?)`)
              .run(newLogId, target.telefono, target.nombre || '', err?.message || 'Error');
          }
          db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, newLogId);
          if (i < failedRows.length - 1) {
            await new Promise(r => setTimeout(r, (minDelay + Math.random() * (maxDelay - minDelay)) * 1000));
            if (sentInSession > 0 && sentInSession % 15 === 0) {
              await new Promise(r => setTimeout(r, (20 + Math.random() * 20) * 1000));
            }
          }
        }
        const finalLog = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(newLogId) as any;
        const finalStatus = (finalLog?.status === 'CANCELLED' || finalLog?.status === 'PAUSED') ? finalLog.status : 'COMPLETED';
        db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ?, status = ? WHERE id = ?').run(successCount, failCount, finalStatus, newLogId);
      };

      runRetry().catch(err => console.error('[BROADCAST] runRetry error:', err));
      res.json({ success: true, log_id: newLogId, target_count: failedRows.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/broadcast/:id/recipients', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA' && role !== 'SUBJEFE') return res.status(403).json({ error: 'Prohibido' });
    const logId = parseInt(req.params.id);
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const page = parseInt((req.query.page as string) || '1');
    const limit = Math.min(parseInt((req.query.limit as string) || '200'), 500);
    const offset = (page - 1) * limit;
    const filterStatus = req.query.status as string | undefined;

    try {
      const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
      if (!log) return res.status(404).json({ error: 'Log no encontrado' });
      if (role !== 'SUPERUSUARIO' && user?.campaign_id && log.campaign_id && log.campaign_id !== user.campaign_id) {
        return res.status(403).json({ error: 'Prohibido' });
      }

      let where = 'WHERE log_id = ?';
      const params: any[] = [logId];
      if (filterStatus) { where += ' AND status = ?'; params.push(filterStatus); }

      const total = (db.prepare(`SELECT COUNT(*) as cnt FROM whatsapp_broadcast_recipients ${where}`).get(...params) as any).cnt;
      const recipients = db.prepare(
        `SELECT id, telefono, nombre, status, error_msg, sent_at FROM whatsapp_broadcast_recipients ${where} ORDER BY id ASC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);

      res.json({ recipients, total, page, pages: Math.ceil(total / limit), limit });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/direct-message', broadcastLimiter, async (req, res) => {
    const { number, message, media_url, media_type, lat, lng, terminalId: reqTerminalId, use_spintax } = req.body;
    const terminalId = reqTerminalId || 'default';
    try {
      let finalMessage = message;
      if (use_spintax && finalMessage) finalMessage = addSubtleVariation(finalMessage);

      if (media_type === 'VOICE') {
        await whatsappService.sendVoice(terminalId, number, media_url);
      } else if (media_type === 'LOCATION') {
        await whatsappService.sendLocation(terminalId, number, lat, lng, finalMessage);
      } else if (media_url) {
        await whatsappService.sendMedia(terminalId, number, media_url, finalMessage);
      } else {
        await whatsappService.sendMessage(terminalId, number, finalMessage);
      }
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/messages', (req, res) => {
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const role = getRole(req);
    try {
      let sql = 'SELECT * FROM whatsapp_messages WHERE 1=1';
      const params: any[] = [];
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) { sql += ' AND campaign_id = ?'; params.push(user.campaign_id); }
      sql += ' ORDER BY timestamp DESC LIMIT 1000';
      const messages = db.prepare(sql).all(...params) as any[];
      res.json(messages.reverse());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/chats', (req, res) => {
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const role = getRole(req);
    try {
      let sql = `
        SELECT
          m1.contact_number,
          COALESCE((SELECT m2.contact_name FROM whatsapp_messages m2 WHERE m2.contact_number = m1.contact_number AND m2.campaign_id = m1.campaign_id AND m2.contact_name IS NOT NULL LIMIT 1), m1.contact_number) as contact_name,
          m1.body as last_message, m1.timestamp, m1.is_incoming,
          (SELECT COUNT(*) FROM whatsapp_messages WHERE contact_number = m1.contact_number AND campaign_id = m1.campaign_id AND is_incoming = 1) as unread_count,
          m1.phone_number
        FROM whatsapp_messages m1
        WHERE m1.id IN (SELECT MAX(id) FROM whatsapp_messages WHERE 1=1 ${role !== 'SUPERUSUARIO' && user?.campaign_id ? 'AND campaign_id = ?' : ''} GROUP BY contact_number)
        ORDER BY m1.timestamp DESC
      `;
      const params: any[] = [];
      if (role !== 'SUPERUSUARIO' && user?.campaign_id) params.push(user.campaign_id);
      const chats = db.prepare(sql).all(...params) as any[];

      const resolveRegisteredName = (phone: string | null) => {
        if (!phone) return null;
        const hash = normalizePhone(phone);
        if (!hash) return null;
        try {
          const elector = db.prepare(`SELECT e.nombre, e.apellido FROM electors e JOIN elector_captures ec ON e.ci = ec.elector_ci WHERE ec.phone_hash = ? LIMIT 1`).get(hash) as any;
          if (elector) return `${elector.nombre} ${elector.apellido || ''}`.trim();
        } catch (e) {}
        try {
          const u = db.prepare(`SELECT nombre FROM users WHERE phone_hash = ? LIMIT 1`).get(hash) as any;
          if (u) return u.nombre;
        } catch (e) {}
        return null;
      };

      const resolvedChats = chats.map(chat => {
        const targetPhone = chat.phone_number || chat.contact_number.split('@')[0];
        const registeredName = resolveRegisteredName(targetPhone);
        return { ...chat, contact_name: registeredName || chat.contact_name, phone_number: targetPhone };
      });
      res.json(resolvedChats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/recipients/coordinators', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    try {
      const sec = getSecurityFilter(req, 'u');
      const coordinators = db.prepare(`
        SELECT u.id, u.nombre, u.telefono, u.ci, u.distrito, u.parent_id,
          u.assigned_list_id, l.list_number, l.candidate_alias, l.candidate_nombre, l.ciudad,
          COUNT(ec.id) as capture_count
        FROM users u
        LEFT JOIN lists l ON u.assigned_list_id = l.id
        LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
        WHERE u.role = 'COORDINADOR' AND u.status = 'ACTIVE' ${sec.sql}
        GROUP BY u.id ORDER BY u.nombre
      `).all(...sec.params);
      res.json(coordinators);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/recipients/electors', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const padrinoId = req.query.padrino_id ? parseInt(req.query.padrino_id as string) : null;
    const coordinatorId = req.query.coordinator_id ? parseInt(req.query.coordinator_id as string) : null;
    try {
      const sec = getSecurityFilter(req, 'u');
      let query = `
        SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
          COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
          COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden,
          u.nombre as coordinator_nombre, p.nombre as padrino_nombre
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        JOIN users u ON ec.coordinator_id = u.id
        LEFT JOIN users p ON u.parent_id = p.id
        WHERE ec.telefono IS NOT NULL AND ec.telefono != '' ${sec.sql}
      `;
      const params: any[] = [...sec.params];
      if (coordinatorId) { query += ' AND ec.coordinator_id = ?'; params.push(coordinatorId); }
      else if (padrinoId) { query += ' AND (u.parent_id = ? OR ec.coordinator_id = ?)'; params.push(padrinoId, padrinoId); }
      query += " ORDER BY COALESCE(e.nombre, 'ELECTOR')";
      const electors = db.prepare(query).all(...params);
      res.json((electors as any[]).map(sanitizeElectorData));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/recipients/padrinos', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    try {
      const sec = getSecurityFilter(req, 'u');
      const padrinos = db.prepare(`
        SELECT u.id, u.nombre, u.telefono, u.ci, u.distrito,
          u.assigned_list_id, l.list_number, l.candidate_alias, l.ciudad,
          COUNT(DISTINCT ch.id) as coordinator_count, COUNT(DISTINCT ec.id) as total_captures
        FROM users u
        LEFT JOIN lists l ON u.assigned_list_id = l.id
        LEFT JOIN users ch ON ch.parent_id = u.id AND ch.role = 'COORDINADOR'
        LEFT JOIN elector_captures ec ON ec.coordinator_id = ch.id
        WHERE u.role = 'PADRINO' AND u.status = 'ACTIVE' ${sec.sql}
        GROUP BY u.id ORDER BY u.nombre
      `).all(...sec.params);
      res.json(padrinos);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/recipients/padrinos/:id/team', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const padrinoId = parseInt(req.params.id);
    try {
      const sec = getSecurityFilter(req, 'u');
      const coordinators = db.prepare(`
        SELECT u.id, u.nombre, u.telefono, u.ci, u.distrito, COUNT(ec.id) as capture_count
        FROM users u LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
        WHERE u.parent_id = ? AND u.role = 'COORDINADOR' ${sec.sql}
        GROUP BY u.id ORDER BY u.nombre
      `).all(padrinoId, ...sec.params);

      const electorsRaw = db.prepare(`
        SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
          COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
          COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden,
          u.id as coordinator_id, u.nombre as coordinator_nombre
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        JOIN users u ON ec.coordinator_id = u.id
        WHERE u.parent_id = ? AND ec.telefono IS NOT NULL AND ec.telefono != '' ${sec.sql}
        ORDER BY u.nombre, COALESCE(e.nombre, 'ELECTOR')
      `).all(padrinoId, ...sec.params);

      res.json({ coordinators, electors: electorsRaw });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/recipients/coordinator/:id/electors', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const coordId = parseInt(req.params.id);
    try {
      const sec = getSecurityFilter(req, 'u');
      const electors = db.prepare(`
        SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
          COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
          COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        JOIN users u ON ec.coordinator_id = u.id
        WHERE ec.coordinator_id = ? AND ec.telefono IS NOT NULL AND ec.telefono != '' ${sec.sql}
        ORDER BY COALESCE(e.nombre, 'ELECTOR')
      `).all(coordId, ...sec.params);
      res.json((electors as any[]).map(sanitizeElectorData));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/recipients/search', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
    const rawQ = (req.query.q as string) || '';
    const q = `%${rawQ}%`;
    const isPhoneSearch = /^\d+$/.test(rawQ.replace(/\D/g, ''));
    try {
      const sec = getSecurityFilter(req, 'u');
      const users = db.prepare(`
        SELECT u.id, u.nombre, u.telefono, u.ci, u.role, u.distrito FROM users u
        WHERE u.telefono IS NOT NULL AND u.telefono != '' AND u.status = 'ACTIVE'
          AND (u.nombre LIKE ? OR u.ci LIKE ? ${isPhoneSearch ? 'OR u.phone_hash = ?' : 'OR u.telefono LIKE ?'}) ${sec.sql}
        LIMIT 10
      `).all(q, q, isPhoneSearch ? normalizePhone(rawQ) : q, ...sec.params);

      const electors = db.prepare(`
        SELECT ec.elector_ci, ec.telefono, ec.traffic_light,
          COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
          COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        WHERE ec.telefono IS NOT NULL AND ec.telefono != ''
          AND (COALESCE(e.nombre, '') LIKE ? OR COALESCE(e.apellido, '') LIKE ? OR ec.elector_ci LIKE ? ${isPhoneSearch ? 'OR ec.phone_hash = ?' : 'OR ec.telefono LIKE ?'})
        LIMIT 10
      `).all(q, q, q, isPhoneSearch ? normalizePhone(rawQ) : q);

      res.json({ users, electors: (electors as any[]).map(sanitizeElectorData) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
