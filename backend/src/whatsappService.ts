import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import db from './db';
import fs from 'fs';
import path from 'path';

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
    this.terminals.set(id, { id, name, status: 'DISCONNECTED', qr: null, lastError: null, campaign_id: campaignId || null });
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
      browser: ['Intelecciones', 'Chrome', '121.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
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
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`[WHATSAPP][${terminalId}] Closed. Code=${statusCode} LoggedOut=${loggedOut}`);

        t.status = 'DISCONNECTED';
        t.qr = null;
        t.lastError = loggedOut
          ? 'Sesión cerrada. Escanea el QR nuevamente.'
          : `Desconectado (código ${statusCode})`;
        this.clients.delete(terminalId);

        if (loggedOut) {
          // Wipe local creds so next connect forces a fresh QR
          const sp = this.getSessionPath(terminalId);
          try { fs.rmSync(sp, { recursive: true, force: true }); } catch {}
          try { fs.mkdirSync(sp, { recursive: true }); } catch {}
        } else {
          // Auto-reconnect for any other reason (network drop, server restart, etc.)
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

  async sendMessage(terminalId: string, number: string, message: string) {
    const sock = this.clients.get(terminalId);
    if (!sock || this.terminals.get(terminalId)?.status !== 'CONNECTED') {
      throw new Error('Terminal no conectada');
    }

    const jid = toJid(number);
    const phoneNumber = jid.split('@')[0];

    try {
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
      await sock.sendPresenceUpdate('paused', jid);
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

    try {
      await sock.sendPresenceUpdate('recording', jid);
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
      await sock.sendPresenceUpdate('paused', jid);
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

    try {
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
      await sock.sendPresenceUpdate('paused', jid);
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

  startMaintenance() {
    setInterval(async () => {
      for (const [id, terminal] of this.terminals) {
        if (terminal.status === 'DISCONNECTED' && !this.reconnectTimers.has(id)) {
          console.log(`[WHATSAPP][MAINTENANCE] ${id} offline — reconnecting`);
          this.connect(id).catch(() => {});
        }
      }
    }, 300_000); // every 5 minutes
  }
}

export const whatsappService = new WhatsAppManager();
whatsappService.startMaintenance();
