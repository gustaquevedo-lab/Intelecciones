import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import axios from 'axios';
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
  private clients: Map<string, Client> = new Map();
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

  private initClient(terminalId: string) {
    if (this.clients.has(terminalId)) return this.clients.get(terminalId)!;

    const sessionPath = process.env.NODE_ENV === 'production'
      ? `/app/data/whatsapp_session_${terminalId}`
      : path.join(__dirname, `../sessions/session_${terminalId}`);

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: {
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
          '--single-process', '--disable-gpu'
        ],
        headless: true
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
      console.log(`[WHATSAPP][${terminalId}] Client is READY!`);
    });

    client.on('disconnected', (reason) => {
      terminal.status = 'DISCONNECTED';
      terminal.lastError = `Desconectado: ${reason}`;
      this.clients.delete(terminalId);
    });

    client.on('message', async (msg) => {
      try {
        const contact = await msg.getContact();
        let mediaUrl = null;
        if (msg.hasMedia) {
          const media = await msg.downloadMedia();
          if (media) {
            const filename = `${Date.now()}-${terminalId}.${media.mimetype.split('/')[1]}`;
            const filePath = path.join(__dirname, '../uploads', filename);
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
}

export const whatsappService = new WhatsAppManager();
