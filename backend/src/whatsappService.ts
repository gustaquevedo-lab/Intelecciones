// WhatsApp Service - Build Trigger
import type { Client as ClientType } from 'whatsapp-web.js';

let Client: any = null;
let LocalAuth: any = null;
let MessageMedia: any = null;
let Location: any = null;

function loadWhatsappWeb() {
  if (!Client) {
    console.log('[WHATSAPP] Lazy loading whatsapp-web.js...');
    const wweb = require('whatsapp-web.js');
    Client = wweb.Client;
    LocalAuth = wweb.LocalAuth;
    MessageMedia = wweb.MessageMedia;
    Location = wweb.Location;
    console.log('[WHATSAPP] whatsapp-web.js loaded successfully!');
  }
}
import qrcode from 'qrcode';
import db from './db';
import fs from 'fs';
import path from 'path';

interface TerminalInfo {
  id: string;
  name: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  qr: string | null;
  lastError: string | null;
}

class WhatsAppManager {
  private clients: Map<string, ClientType> = new Map();
  private terminals: Map<string, TerminalInfo> = new Map();

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
          lastError: null
        });
      });
      // Always ensure a default terminal exists
      if (!this.terminals.has('default')) {
        this.addTerminal('default', 'Terminal Principal');
      }
    } catch (err) {
      console.error('Error loading terminals:', err);
    }
  }

  async addTerminal(id: string, name: string) {
    db.prepare('INSERT OR IGNORE INTO whatsapp_terminals (id, name) VALUES (?, ?)').run(id, name);
    this.terminals.set(id, { id, name, status: 'DISCONNECTED', qr: null, lastError: null });
  }

  async getTerminals() {
    return Array.from(this.terminals.values());
  }

  /** Remove Chromium singleton lock files left from a crashed/killed process */
  private clearChromiumLocks(userDataDir: string) {
    // These files are created by Chromium to prevent multiple instances.
    // On Railway container restarts the process is killed but files remain → next launch fails.
    // We search recursively for these files because Chromium/Puppeteer/LocalAuth 
    // nested structures can be complex.
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile'];
    
    const cleanup = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            cleanup(fullPath);
          } else if (lockFiles.includes(entry.name)) {
            try {
              fs.unlinkSync(fullPath);
              console.log(`[WHATSAPP] Removed stale lock: ${fullPath}`);
            } catch (e) {
              console.error(`[WHATSAPP] Failed to remove lock ${fullPath}:`, e);
            }
          }
        }
      } catch (err) {
        console.error(`[WHATSAPP] Error during lock cleanup in ${dir}:`, err);
      }
    };

    cleanup(userDataDir);
    
    // Also specifically target the LocalAuth internal folders which are notorious for this
    const wwebjsDir = path.join(userDataDir, '.wwebjs_auth');
    if (fs.existsSync(wwebjsDir)) {
      cleanup(wwebjsDir);
    }
  }

  private initClient(terminalId: string) {
    if (this.clients.has(terminalId)) return this.clients.get(terminalId)!;

    const sessionPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, `whatsapp_session_${terminalId}`)
      : (process.env.NODE_ENV === 'production'
        ? `/app/data/whatsapp_session_${terminalId}`
        : path.join(__dirname, `../sessions/session_${terminalId}`));

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Clear stale Chromium lock files before every launch (Railway restart safety)
    this.clearChromiumLocks(sessionPath);

    loadWhatsappWeb();

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      takeoverOnConflict: true,
      authTimeoutMs: 120000,
      puppeteer: {
        handleSIGINT: false,
        executablePath: process.env.CHROME_BIN || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-software-rasterizer',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process,TranslateUI',
          '--aggressive-cache-discard',
          '--ignore-certificate-errors',
        ],
        headless: true
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      }
    });

    const terminal = this.terminals.get(terminalId)!;

    client.on('qr', async (qr) => {
      console.log(`[WHATSAPP][${terminalId}] QR Code received`);
      terminal.status = 'CONNECTING';
      terminal.qr = await qrcode.toDataURL(qr);
    });

    client.on('ready', () => {
      terminal.status = 'CONNECTED';
      terminal.qr = null;
      terminal.lastError = null;
      console.log(`[WHATSAPP][${terminalId}] Client is READY!`);
    });

    client.on('auth_failure', (msg) => {
      terminal.status = 'DISCONNECTED';
      terminal.lastError = `Fallo de autenticación: ${msg}`;
      console.error(`[WHATSAPP][${terminalId}] Auth failure:`, msg);
    });

    client.on('disconnected', async (reason) => {
      terminal.status = 'DISCONNECTED';
      terminal.lastError = `Desconectado: ${reason}`;
      console.log(`[WHATSAPP][${terminalId}] Disconnected:`, reason);
      this.clients.delete(terminalId);
      
      // Intentar reconexión automática si no fue un cierre de sesión explícito
      if (reason !== 'LOGOUT') {
        console.log(`[WHATSAPP][${terminalId}] Intentando reconexión automática en 5s...`);
        setTimeout(() => this.connect(terminalId), 5000);
      }
    });

    client.on('message', async (msg) => {
      try {
        const contact = await msg.getContact();
        let mediaUrl = null;
        if (msg.hasMedia) {
          const media = await msg.downloadMedia();
          if (media) {
            const filename = `${Date.now()}-${terminalId}.${media.mimetype.split('/')[1]}`;
            // Correct path for production (Railway Volume)
            const uploadDir = process.env.NODE_ENV === 'production' ? '/app/data/uploads' : path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            
            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
            const host = process.env.APP_URL || 'http://localhost:5000';
            mediaUrl = `${host}/uploads/${filename}`;
          }
        }

        db.prepare(`
          INSERT INTO whatsapp_messages (terminal_id, contact_number, contact_name, body, type, media_url, is_incoming)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(terminalId, msg.from, contact.pushname || contact.name || msg.from, msg.body || '', msg.type, mediaUrl);
      } catch (err) { console.error('Error saving message:', err); }
    });

    this.clients.set(terminalId, client);
    return client;
  }

  async connect(terminalId: string = 'default') {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.status === 'CONNECTED' || terminal.status === 'CONNECTING') return;

    terminal.status = 'CONNECTING';
    const client = this.initClient(terminalId);
    try {
      await client.initialize();
    } catch (err: any) {
      terminal.status = 'DISCONNECTED';
      terminal.qr = null;
      terminal.lastError = err.message;
      this.clients.delete(terminalId);
    }
  }

  async disconnect(terminalId: string = 'default') {
    const client = this.clients.get(terminalId);
    if (client) {
      try {
        await client.logout();
        await client.destroy();
      } catch (e) {}
      this.clients.delete(terminalId);
    }
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.status = 'DISCONNECTED';
      terminal.qr = null;
    }
  }

  getStatus(terminalId: string = 'default') {
    return this.terminals.get(terminalId) || null;
  }

  async sendMessage(terminalId: string, number: string, message: string) {
    const client = this.clients.get(terminalId);
    if (!client || this.terminals.get(terminalId)?.status !== 'CONNECTED') throw new Error('Terminal no conectada');
    
    const cleanNumber = number.replace(/\D/g, '');
    const chatId = `${cleanNumber.startsWith('595') ? cleanNumber : '595'+cleanNumber.replace(/^0/,'')}@c.us`;
    
    const res = await client.sendMessage(chatId, message);
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, is_incoming)
      VALUES (?, ?, ?, 'chat', 0)
    `).run(terminalId, chatId, message);
    return res;
  }

  async sendVoice(terminalId: string, number: string, mediaUrl: string) {
    loadWhatsappWeb();
    const client = this.clients.get(terminalId);
    if (!client || this.terminals.get(terminalId)?.status !== 'CONNECTED') throw new Error('Terminal no conectada');
    
    const cleanNumber = number.replace(/\D/g, '');
    const chatId = `${cleanNumber.startsWith('595') ? cleanNumber : '595'+cleanNumber.replace(/^0/,'')}@c.us`;
    
    const media = await MessageMedia.fromUrl(mediaUrl);
    const res = await client.sendMessage(chatId, media, { sendAudioAsVoice: true });
    
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, media_url, is_incoming)
      VALUES (?, ?, 'Nota de voz', 'ptt', ?, 0)
    `).run(terminalId, chatId, mediaUrl);
    return res;
  }

  async sendLocation(terminalId: string, number: string, lat: number, lng: number, message?: string) {
    loadWhatsappWeb();
    const client = this.clients.get(terminalId);
    if (!client || this.terminals.get(terminalId)?.status !== 'CONNECTED') throw new Error('Terminal no conectada');
    
    const cleanNumber = number.replace(/\D/g, '');
    const chatId = `${cleanNumber.startsWith('595') ? cleanNumber : '595'+cleanNumber.replace(/^0/,'')}@c.us`;
    
    const location = new Location(lat, lng, { name: message || 'Ubicación' } as any);
    const res = await client.sendMessage(chatId, location);
    
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, is_incoming)
      VALUES (?, ?, ?, 'location', 0)
    `).run(terminalId, chatId, message || 'Ubicación');
    return res;
  }

  async sendContact(terminalId: string, number: string, contactName: string, contactPhone: string) {
    const client = this.clients.get(terminalId);
    if (!client || this.terminals.get(terminalId)?.status !== 'CONNECTED') throw new Error('Terminal no conectada');
    
    const cleanNumber = number.replace(/\D/g, '');
    const chatId = `${cleanNumber.startsWith('595') ? cleanNumber : '595'+cleanNumber.replace(/^0/,'')}@c.us`;
    
    // This is a bit complex in whatsapp-web.js, usually involves vcard
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL;type=VOICE;waid=${contactPhone.replace(/\D/g,'')}:+${contactPhone.replace(/\D/g,'')}\nEND:VCARD`;
    const res = await client.sendMessage(chatId, vcard);
    
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, is_incoming)
      VALUES (?, ?, ?, 'contact', 0)
    `).run(terminalId, chatId, `Contacto: ${contactName}`);
    return res;
  }

  async sendMedia(terminalId: string, number: string, mediaUrl: string, message?: string) {
    loadWhatsappWeb();
    const client = this.clients.get(terminalId);
    if (!client || this.terminals.get(terminalId)?.status !== 'CONNECTED') throw new Error('Terminal no conectada');
    
    const cleanNumber = number.replace(/\D/g, '');
    const chatId = `${cleanNumber.startsWith('595') ? cleanNumber : '595'+cleanNumber.replace(/^0/,'')}@c.us`;
    
    const media = await MessageMedia.fromUrl(mediaUrl);
    const res = await client.sendMessage(chatId, media, { caption: message });
    
    db.prepare(`
      INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, media_url, is_incoming)
      VALUES (?, ?, ?, 'media', ?, 0)
    `).run(terminalId, chatId, message || 'Archivo', mediaUrl);
    return res;
  }

  // 🛠️ Auto-repair and monitoring
  startMaintenance() {
    setInterval(async () => {
      for (const [id, terminal] of this.terminals) {
        if (terminal.status === 'DISCONNECTED') {
          console.log(`[WHATSAPP][MAINTENANCE] Terminal ${id} disconnected. Repairing...`);
          try {
            await this.connect(id);
          } catch (e) {}
        }
      }
    }, 300000); // Check every 5 minutes
  }
}

export const whatsappService = new WhatsAppManager();
whatsappService.startMaintenance();
