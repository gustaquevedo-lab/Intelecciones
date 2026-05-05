import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import axios from 'axios';
import { db } from './db';

class WhatsAppService {
  private client: Client;
  private qrCode: string | null = null;
  private status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' = 'DISCONNECTED';

  constructor() {
    const sessionPath = process.env.NODE_ENV === 'production'
      ? '/app/data/whatsapp_session'
      : './sessions';

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: {
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        headless: true
      }
    });

    this.client.on('qr', async (qr) => {
      this.status = 'CONNECTING';
      this.qrCode = await qrcode.toDataURL(qr);
    });

    this.client.on('ready', () => {
      this.status = 'CONNECTED';
      this.qrCode = null;
      console.log('WhatsApp client is ready!');
    });

    this.client.on('disconnected', () => {
      this.status = 'DISCONNECTED';
    });

    this.client.on('message', async (msg) => {
      try {
        const contact = await msg.getContact();
        db.prepare(`
          INSERT INTO whatsapp_messages (contact_number, contact_name, body, type, is_incoming)
          VALUES (?, ?, ?, ?, 1)
        `).run(msg.from, contact.pushname || contact.name || msg.from, msg.body, msg.type);
      } catch (err) { console.error('Error saving message:', err); }
    });
  }

  async connect() {
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return;
    this.status = 'CONNECTING';
    try {
      await this.client.initialize();
    } catch (err) {
      this.status = 'DISCONNECTED';
      console.error('Failed to initialize WhatsApp client', err);
    }
  }

  async disconnect() {
    try {
      await this.client.logout();
      await this.client.destroy();
      this.status = 'DISCONNECTED';
      this.qrCode = null;
    } catch (err) { console.error(err); }
  }

  getStatus() {
    return { status: this.status, qr: this.qrCode };
  }

  private async getChatId(number: string) {
    let cleanNumber = number.replace(/\D/g, '');
    if (!cleanNumber.startsWith('595')) {
      cleanNumber = `595${cleanNumber.replace(/^0/, '')}`;
    }
    return `${cleanNumber}@c.us`;
  }

  async sendMessage(number: string, message: string) {
    if (this.status !== 'CONNECTED') throw new Error('WhatsApp no conectado');
    const chatId = await this.getChatId(number);
    const res = await this.client.sendMessage(chatId, message);
    
    // Log outgoing message
    db.prepare(`
      INSERT INTO whatsapp_messages (contact_number, body, type, is_incoming)
      VALUES (?, ?, 'chat', 0)
    `).run(chatId, message);
    
    return res;
  }

  async sendMedia(number: string, mediaUrl: string, caption?: string) {
    if (this.status !== 'CONNECTED') throw new Error('WhatsApp no conectado');
    const chatId = await this.getChatId(number);
    
    const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    const mimetype = response.headers['content-type'];
    const media = new MessageMedia(
      mimetype,
      Buffer.from(response.data).toString('base64'),
      mediaUrl.split('/').pop()
    );

    const res = await this.client.sendMessage(chatId, media, { caption });
    
    // Log outgoing message
    db.prepare(`
      INSERT INTO whatsapp_messages (contact_number, body, type, media_url, is_incoming)
      VALUES (?, ?, ?, ?, 0)
    `).run(chatId, caption || '', mimetype.split('/')[0], mediaUrl);
    
    return res;
  }

  async sendVoice(number: string, audioUrl: string) {
    if (this.status !== 'CONNECTED') throw new Error('WhatsApp no conectado');
    const chatId = await this.getChatId(number);
    
    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const mimetype = response.headers['content-type'];
    const media = new MessageMedia(
      mimetype,
      Buffer.from(response.data).toString('base64')
    );

    // sendAudio with sendAudioAsVoice: true makes it appear as a voice note (PTT)
    return await this.client.sendMessage(chatId, media, { sendAudioAsVoice: true });
  }

  async sendLocation(number: string, lat: number, lng: number, description?: string) {
    if (this.status !== 'CONNECTED') throw new Error('WhatsApp no conectado');
    const chatId = await this.getChatId(number);
    return await this.client.sendMessage(chatId, {
      location: {
        latitude: lat,
        longitude: lng,
        description: description || 'Ubicación compartida'
      }
    } as any);
  }

  async sendContact(targetNumber: string, contactName: string, contactNumber: string) {
    if (this.status !== 'CONNECTED') throw new Error('WhatsApp no conectado');
    const chatId = await this.getChatId(targetNumber);
    
    // Generate simple VCard
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL;type=VOICE;waid=${contactNumber.replace(/\D/g, '')}:${contactNumber}\nEND:VCARD`;
    
    return await this.client.sendMessage(chatId, vcard);
  }
}

export const whatsappService = new WhatsAppService();
