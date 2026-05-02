import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';

class WhatsAppService {
  private client: Client;
  private qrCode: string | null = null;
  private status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' = 'DISCONNECTED';

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './sessions' }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      }
    });

    this.client.on('qr', async (qr) => {
      console.log('WhatsApp QR Received');
      this.qrCode = await qrcode.toDataURL(qr);
      this.status = 'DISCONNECTED';
    });

    this.client.on('ready', () => {
      console.log('WhatsApp Client Ready');
      this.status = 'CONNECTED';
      this.qrCode = null;
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp Authenticated');
    });

    this.client.on('auth_failure', () => {
      this.status = 'DISCONNECTED';
      console.error('WhatsApp Auth Failure');
    });

    this.client.on('disconnected', () => {
      this.status = 'DISCONNECTED';
      console.log('WhatsApp Disconnected');
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

  async sendMessage(number: string, message: string) {
    if (this.status !== 'CONNECTED') throw new Error('WhatsApp not connected');
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    return await this.client.sendMessage(chatId, message);
  }
}

export const whatsappService = new WhatsAppService();
