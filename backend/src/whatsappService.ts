import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  proto,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import db from './db';
import fs from 'fs';
import path from 'path';
import { processIncomingMessage } from './whatsappAutoresponder';

type WASocket = ReturnType<typeof makeWASocket>;

// Silent logger — Baileys is very noisy by default
const baileysLogger = {
  level: 'silent',
  trace() {}, debug() {}, info() {}, warn() {},
  error() {}, fatal() {},
  child() { return this; },
} as any;

function toJid(number: string): string {
  const clean = number.replace(/\D/g, '');
  const withCountry = clean.startsWith('595') ? clean : '595' + clean.replace(/^0/, '');
  return `${withCountry}@s.whatsapp.net`;
}

function getMessageText(msg: proto.IWebMessageInfo): string {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    ''
  );
}

function getMessageType(msg: proto.IWebMessageInfo): string {
  if (msg.message?.imageMessage) return 'image';
  if (msg.message?.videoMessage) return 'video';
  if (msg.message?.documentMessage) return 'document';
  if (msg.message?.stickerMessage) return 'sticker';
  if (msg.message?.audioMessage) {
    return msg.message.audioMessage.ptt ? 'ptt' : 'audio';
  }
  return 'chat';
}

async function getMediaBuffer(mediaUrl: string): Promise<{ buffer: Buffer; mimetype: string; filename: string }> {
  // Try loading from local uploads first
  let filename = '';
  if (mediaUrl.includes('/uploads/')) {
    filename = mediaUrl.split('/uploads/').pop()!;
  } else if (!mediaUrl.startsWith('http') && mediaUrl.match(/^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+$/)) {
    filename = mediaUrl;
  }

  if (filename) {
    const uploadDir = process.env.NODE_ENV === 'production'
      ? '/app/data/uploads'
      : path.join(__dirname, '../uploads');
    const localPath = path.join(uploadDir, filename);
    if (fs.existsSync(localPath)) {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(filename).toLowerCase().slice(1);
      const mimes: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp',
        mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
        mp4: 'video/mp4',
        pdf: 'application/pdf',
      };
      return { buffer, mimetype: mimes[ext] || 'application/octet-stream', filename };
    }
  }

  const resp = await fetch(mediaUrl);
  if (!resp.ok) throw new Error(`Failed to fetch media: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const mimetype = resp.headers.get('content-type') || 'application/octet-stream';
  const urlFilename = decodeURIComponent(mediaUrl.split('/').pop()?.split('?')[0] || 'file');
  return { buffer, mimetype, filename: urlFilename };
}

interface TerminalInfo {
  id: string;
  name: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  qr: string | null;
  lastError: string | null;
  campaign_id?: number | null;
  phone_number?: string | null;
  warmup_enabled?: number;
}

class WhatsAppManager {
  private clients: Map<string, WASocket> = new Map();
  private terminals: Map<string, TerminalInfo> = new Map();
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    this.loadTerminalsFromDb();
  }

  private loadTerminalsFromDb() {
    try {
      const rows = db.prepare('SELECT * FROM whatsapp_terminals').all() as any[];
      rows.forEach(row => {
        this.terminals.set(row.id, {
          id: row.id,
          name: row.name,
          status: 'DISCONNECTED',
          qr: null,
          lastError: null,
          campaign_id: row.campaign_id,
          phone_number: row.phone_number || null,
          warmup_enabled: row.warmup_enabled || 0,
        });
      });
      if (!this.terminals.has('default')) {
        this.addTerminal('default', 'Terminal Principal', null);
      }
    } catch (err) {
      console.error('[WHATSAPP] Error loading terminals:', err);
    }
  }

  async addTerminal(id: string, name: string, campaignId?: number | null) {
    db.prepare('INSERT OR IGNORE INTO whatsapp_terminals (id, name, campaign_id) VALUES (?, ?, ?)').run(id, name, campaignId || null);
    this.terminals.set(id, { id, name, status: 'DISCONNECTED', qr: null, lastError: null, campaign_id: campaignId || null, phone_number: null, warmup_enabled: 0 });
  }

  async getTerminals(campaignId?: number | null) {
    const list = Array.from(this.terminals.values());
    if (campaignId === undefined || campaignId === null) return list;
    return list.filter(t => t.campaign_id === campaignId || t.id === 'default');
  }

  private getSessionPath(terminalId: string): string {
    if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
      return path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, `baileys_${terminalId}`);
    }
    return process.env.NODE_ENV === 'production'
      ? `/app/data/baileys_${terminalId}`
      : path.join(__dirname, `../sessions/baileys_${terminalId}`);
  }

  private scheduleReconnect(terminalId: string, delayMs: number) {
    const existing = this.reconnectTimers.get(terminalId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(terminalId);
      console.log(`[WHATSAPP][${terminalId}] Reconnecting...`);
      this.connect(terminalId).catch(e => console.error(`[WHATSAPP][${terminalId}] Reconnect failed:`, e));
    }, delayMs);
    this.reconnectTimers.set(terminalId, timer);
  }

  private async initSocket(terminalId: string): Promise<WASocket> {
    const sessionPath = this.getSessionPath(terminalId);
    fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    let version: [number, number, number] = [2, 3000, 1015920613];
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
    } catch {
      console.log('[WHATSAPP] Using fallback WA version');
    }

    const sock = makeWASocket({
      version,
      auth: state,
      logger: baileysLogger,
      printQRInTerminal: false,
      browser: Browsers.windows('Desktop'),
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      markOnlineOnConnect: true,
    });

    const terminal = this.terminals.get(terminalId)!;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      const t = this.terminals.get(terminalId);
      if (!t) return;

      if (qr) {
        console.log(`[WHATSAPP][${terminalId}] QR ready`);
        t.status = 'CONNECTING';
        t.qr = await qrcode.toDataURL(qr);
        t.lastError = null;
      }

      if (connection === 'open') {
        console.log(`[WHATSAPP][${terminalId}] Connected`);
        t.status = 'CONNECTED';
        t.qr = null;
        t.lastError = null;
        
        try {
          const rawId = sock.user?.id || '';
          const ownNumber = rawId.split(':')[0] || rawId.split('@')[0];
          if (ownNumber) {
            db.prepare('UPDATE whatsapp_terminals SET phone_number = ? WHERE id = ?').run(ownNumber, terminalId);
            t.phone_number = ownNumber;
            console.log(`[WHATSAPP][${terminalId}] Connected with number: ${ownNumber}`);
          }
        } catch (err: any) {
          console.error(`[WHATSAPP][${terminalId}] Error saving own number:`, err.message);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const isTimeout = statusCode === DisconnectReason.timedOut || statusCode === 408;
        console.log(`[WHATSAPP][${terminalId}] Closed. Code=${statusCode} LoggedOut=${loggedOut} Timeout=${isTimeout}`);

        t.status = 'DISCONNECTED';
        t.qr = null;
        t.lastError = loggedOut
          ? 'Sesión cerrada. Escanea el QR nuevamente.'
          : isTimeout
          ? 'Tiempo de espera de código QR agotado. Inicia la conexión cuando estés listo para escanear.'
          : `Desconectado (código ${statusCode})`;
        this.clients.delete(terminalId);

        if (loggedOut) {
          // Wipe local creds so next connect forces a fresh QR
          const sp = this.getSessionPath(terminalId);
          try { fs.rmSync(sp, { recursive: true, force: true }); } catch {}
          try { fs.mkdirSync(sp, { recursive: true }); } catch {}
        } else if (isTimeout) {
          // Stop infinite reconnect loops on QR timeout — user will request connect when ready to scan
          console.log(`[WHATSAPP][${terminalId}] QR timed out without scan. Pausing reconnection loop.`);
        } else {
          // Auto-reconnect for genuine network drops
          this.scheduleReconnect(terminalId, 5000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const from = msg.key.remoteJid!;
        if (from.endsWith('@g.us')) continue; // skip groups
        const phoneNumber = from.split('@')[0];

        try {
          const body = getMessageText(msg);
          const msgType = getMessageType(msg);
          const pushName = msg.pushName || from;

          let mediaUrl: string | null = null;
          const hasMedia = !!(
            msg.message?.imageMessage ||
            msg.message?.audioMessage ||
            msg.message?.videoMessage ||
            msg.message?.documentMessage
          );

          if (hasMedia) {
            try {
              const buffer = await downloadMediaMessage(
                msg, 'buffer', {},
                { logger: baileysLogger, reuploadRequest: sock.updateMediaMessage }
              ) as Buffer;
              const ext = msg.message?.imageMessage ? 'jpg'
                : msg.message?.videoMessage ? 'mp4'
                : msg.message?.audioMessage ? 'ogg'
                : 'bin';
              const filename = `${Date.now()}-${terminalId}-in.${ext}`;
              const uploadDir = process.env.NODE_ENV === 'production'
                ? '/app/data/uploads'
                : path.join(__dirname, '../uploads');
              if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
              fs.writeFileSync(path.join(uploadDir, filename), buffer);
              const host = process.env.APP_URL || 'http://localhost:5000';
              mediaUrl = `${host}/uploads/${filename}`;
            } catch (e) {
              console.error('[WHATSAPP] Failed to download incoming media:', e);
            }
          }

          db.prepare(`
            INSERT INTO whatsapp_messages
              (terminal_id, contact_number, contact_name, body, type, media_url, is_incoming, campaign_id, phone_number)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(terminalId, from, pushName, body, msgType, mediaUrl, terminal.campaign_id || null, phoneNumber);

          // Run autoresponder asynchronously
          if (body && msgType === 'chat') {
            processIncomingMessage(sock, from, body, terminalId).catch(err => {
              console.error(`[AUTORESPONDER] Error processing message from ${from}:`, err);
            });
          }
        } catch (err) {
          console.error('[WHATSAPP] Error saving message:', err);
        }
      }
    });

    this.clients.set(terminalId, sock);
    return sock;
  }

  async connect(terminalId: string = 'default') {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;
    if (terminal.status === 'CONNECTED' || terminal.status === 'CONNECTING') return;

    terminal.status = 'CONNECTING';
    terminal.qr = null;

    try {
      await this.initSocket(terminalId);
    } catch (err: any) {
      terminal.status = 'DISCONNECTED';
      terminal.lastError = err.message;
      this.clients.delete(terminalId);
      console.error(`[WHATSAPP][${terminalId}] Init error:`, err.message);
      this.scheduleReconnect(terminalId, 10000);
    }
  }

  async disconnect(terminalId: string = 'default') {
    // Cancel pending auto-reconnect
    const timer = this.reconnectTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(terminalId);
    }

    const sock = this.clients.get(terminalId);
    this.clients.delete(terminalId);

    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.status = 'DISCONNECTED';
      terminal.qr = null;
    }

    if (sock) {
      try { await sock.logout(); } catch {
        try { sock.end(undefined); } catch {}
      }
    }
  }

  getStatus(terminalId: string = 'default') {
    return this.terminals.get(terminalId) || null;
  }

  async checkNumberExists(terminalId: string, number: string): Promise<boolean> {
    const sock = this.clients.get(terminalId);
    if (!sock || this.terminals.get(terminalId)?.status !== 'CONNECTED') {
      throw new Error('Terminal no conectada');
    }
    const jid = toJid(number);
    try {
      const [result] = await sock.onWhatsApp(jid);
      return !!result?.exists;
    } catch (err) {
      console.warn(`[WHATSAPP][${terminalId}] Error checking onWhatsApp for ${number}:`, err);
      return true; // Default to true on connection or rate-limit issues to avoid false negatives
    }
  }

  async sendMessage(terminalId: string, number: string, message: string) {
    const sock = this.clients.get(terminalId);
    if (!sock || this.terminals.get(terminalId)?.status !== 'CONNECTED') {
      throw new Error('Terminal no conectada');
    }

    const jid = toJid(number);
    const phoneNumber = jid.split('@')[0];

    // Simulate realistic typing based on message length
    const typingMs = Math.min(Math.max((message.length / 3.3) * 1000 + 1500 + Math.random() * 2500, 3000), 12000);
    try {
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, typingMs));
      await sock.sendPresenceUpdate('paused', jid);
      // Small pause after "finishing typing" before sending
      await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
    } catch {}

    const result = await sock.sendMessage(jid, { text: message });

    const terminal = this.terminals.get(terminalId);
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, is_incoming, campaign_id, phone_number)
      VALUES (?, ?, ?, 'chat', 0, ?, ?)
    `).run(terminalId, jid, message, terminal?.campaign_id || null, phoneNumber);

    return result;
  }

  async sendVoice(terminalId: string, number: string, mediaUrl: string) {
    const sock = this.clients.get(terminalId);
    if (!sock || this.terminals.get(terminalId)?.status !== 'CONNECTED') {
      throw new Error('Terminal no conectada');
    }

    const jid = toJid(number);
    const phoneNumber = jid.split('@')[0];

    // Simulate recording time (voice notes take 5-15 seconds typically)
    try {
      await sock.sendPresenceUpdate('recording', jid);
      await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000));
      await sock.sendPresenceUpdate('paused', jid);
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    } catch {}

    const { buffer, mimetype } = await getMediaBuffer(mediaUrl);
    const result = await sock.sendMessage(jid, {
      audio: buffer,
      ptt: true,
      mimetype: mimetype.includes('ogg') ? 'audio/ogg; codecs=opus' : 'audio/mp4',
    });

    const terminal = this.terminals.get(terminalId);
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, media_url, is_incoming, campaign_id, phone_number)
      VALUES (?, ?, 'Nota de voz', 'ptt', ?, 0, ?, ?)
    `).run(terminalId, jid, mediaUrl, terminal?.campaign_id || null, phoneNumber);

    return result;
  }

  async sendLocation(terminalId: string, number: string, lat: number, lng: number, message?: string) {
    const sock = this.clients.get(terminalId);
    if (!sock || this.terminals.get(terminalId)?.status !== 'CONNECTED') {
      throw new Error('Terminal no conectada');
    }

    const jid = toJid(number);
    const phoneNumber = jid.split('@')[0];

    const result = await sock.sendMessage(jid, {
      location: { degreesLatitude: lat, degreesLongitude: lng, name: message || 'Ubicación' },
    });

    const terminal = this.terminals.get(terminalId);
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, is_incoming, campaign_id, phone_number)
      VALUES (?, ?, ?, 'location', 0, ?, ?)
    `).run(terminalId, jid, message || 'Ubicación', terminal?.campaign_id || null, phoneNumber);

    return result;
  }

  async sendContact(terminalId: string, number: string, contactName: string, contactPhone: string) {
    const sock = this.clients.get(terminalId);
    if (!sock || this.terminals.get(terminalId)?.status !== 'CONNECTED') {
      throw new Error('Terminal no conectada');
    }

    const jid = toJid(number);
    const phoneNumber = jid.split('@')[0];
    const cleanPhone = contactPhone.replace(/\D/g, '');

    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contactName}`,
      `TEL;type=CELL;type=VOICE;waid=${cleanPhone}:+${cleanPhone}`,
      'END:VCARD',
    ].join('\n');

    const result = await sock.sendMessage(jid, {
      contacts: { displayName: contactName, contacts: [{ vcard }] },
    });

    const terminal = this.terminals.get(terminalId);
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, is_incoming, campaign_id, phone_number)
      VALUES (?, ?, ?, 'contact', 0, ?, ?)
    `).run(terminalId, jid, `Contacto: ${contactName}`, terminal?.campaign_id || null, phoneNumber);

    return result;
  }

  async sendMedia(terminalId: string, number: string, mediaUrl: string, caption?: string) {
    const sock = this.clients.get(terminalId);
    if (!sock || this.terminals.get(terminalId)?.status !== 'CONNECTED') {
      throw new Error('Terminal no conectada');
    }

    const jid = toJid(number);
    const phoneNumber = jid.split('@')[0];

    // Simulate: user selects media, writes caption
    const captionLen = (caption || '').length;
    const typingMs = captionLen > 0 ? Math.min((captionLen / 3.3) * 1000 + 2000, 10000) : 2000 + Math.random() * 3000;
    try {
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, typingMs));
      await sock.sendPresenceUpdate('paused', jid);
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    } catch {}

    const { buffer, mimetype, filename } = await getMediaBuffer(mediaUrl);

    let content: any;
    if (mimetype.startsWith('image/')) {
      content = { image: buffer, caption, mimetype };
    } else if (mimetype.startsWith('video/')) {
      content = { video: buffer, caption, mimetype };
    } else if (mimetype.startsWith('audio/')) {
      content = { audio: buffer, mimetype };
    } else {
      content = { document: buffer, mimetype, fileName: filename, caption };
    }

    const result = await sock.sendMessage(jid, content);

    const terminal = this.terminals.get(terminalId);
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, media_url, is_incoming, campaign_id, phone_number)
      VALUES (?, ?, ?, 'media', ?, 0, ?, ?)
    `).run(terminalId, jid, caption || 'Archivo', mediaUrl, terminal?.campaign_id || null, phoneNumber);

    return result;
  }

  getTerminalIds(): string[] {
    return Array.from(this.terminals.keys());
  }

  startMaintenance() {
    setInterval(async () => {
      for (const [id, terminal] of this.terminals) {
        if (terminal.status === 'DISCONNECTED' && !this.reconnectTimers.has(id)) {
          console.log(`[WHATSAPP][MAINTENANCE] ${id} offline — reconnecting`);
          this.connect(id).catch(() => {});
        }
      }
    }, 30_000); // every 30 seconds
  }

  startWarmupScheduler() {
    const WARMUP_PHRASES = [
      'Hola, ¿cómo estás?',
      'Todo bien por acá, ¿y vos?',
      '¡Buen día! ¿Qué tal la jornada?',
      '¿Tenés los números de mesa a mano?',
      'Sí, ya los pasaron al grupo.',
      'Excelente, gracias por confirmar.',
      '¿Alguien tiene novedades del local de votación?',
      'Todo tranquilo por el momento.',
      '¿Vamos a hacer reunión de coordinación hoy?',
      'Creo que sí, más tarde definimos la hora.',
      'Dale, quedo atento.',
      '¿Me avisás cuando esté listo el reporte?',
      'Claro, en un ratito te lo paso.',
      'Perfecto, nos vemos luego.',
      '¡Buenas tardes! ¿Cómo va todo?',
      'Avanzando con los registros de electores.',
      '¡Qué bueno! Seguimos sumando.',
      'Cualquier cosa me pegás un grito.',
      'Listo, te aviso cualquier duda.',
      '¡Fuerza equipo!'
    ];

    // Check every 15 minutes
    setInterval(async () => {
      const hour = parseInt(new Intl.DateTimeFormat('es-PY', {
        timeZone: 'America/Asuncion',
        hour: 'numeric',
        hour12: false
      }).format(new Date()), 10);
      // Only chat between 8:00 and 21:00
      if (hour < 8 || hour > 21) return;

      try {
        const connectedWarmup = Array.from(this.terminals.values()).filter(
          t => t.status === 'CONNECTED' && t.warmup_enabled === 1 && t.phone_number
        );

        if (connectedWarmup.length < 2) return;

        // Pick random sender
        const sender = connectedWarmup[Math.floor(Math.random() * connectedWarmup.length)];
        // Pick receiver different from sender
        let receiver = connectedWarmup[Math.floor(Math.random() * connectedWarmup.length)];
        while (receiver.id === sender.id) {
          receiver = connectedWarmup[Math.floor(Math.random() * connectedWarmup.length)];
        }

        const msg = WARMUP_PHRASES[Math.floor(Math.random() * WARMUP_PHRASES.length)];
        console.log(`[WHATSAPP][WARMUP] Sending automated warm-up message from ${sender.id} to ${receiver.id} (${receiver.phone_number})`);
        
        await this.sendMessage(sender.id, receiver.phone_number!, msg);
      } catch (err: any) {
        console.error('[WHATSAPP][WARMUP] Error in warm-up scheduler:', err.message);
      }
    }, 15 * 60 * 1000);
  }
}

export const whatsappService = new WhatsAppManager();
whatsappService.startMaintenance();
whatsappService.startWarmupScheduler();
