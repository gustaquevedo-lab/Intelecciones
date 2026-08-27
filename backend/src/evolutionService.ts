import axios, { AxiosInstance } from 'axios';
import db from './db';
import { processIncomingMessage } from './whatsappAutoresponder';

export interface TerminalStatus {
  id: string;
  name: string;
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  qr: string | null;
  phone_number: string | null;
  campaign_id: number | null;
  warmup_enabled: number;
}

export class EvolutionWhatsAppService {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private webhookBaseUrl: string;

  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8085';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'c616d81834c74317ad473380a10d35d84d6eacd08a7c467a6e7d79f29c0340d4';
    this.webhookBaseUrl = process.env.APP_URL || 'https://intelecciones.intellihouse.lat';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log(`[EVOLUTION-API] Initialized client pointing to ${this.baseURL}`);
  }

  private getInstanceName(terminalId: string): string {
    const clean = terminalId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return clean.startsWith('intelecciones_') ? clean : `intelecciones_${clean}`;
  }

  private getTerminalIdFromInstance(instanceName: string): string {
    return instanceName.replace(/^intelecciones_/, '');
  }

  private cleanNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('595')) return digits;
    if (digits.startsWith('0')) return '595' + digits.substring(1);
    if (digits.length === 9 && digits.startsWith('9')) return '595' + digits;
    return digits;
  }

  // ── TERMINALS / INSTANCE MANAGEMENT ─────────────────────────────────────────

  async getTerminals(campaignId?: number | null): Promise<TerminalStatus[]> {
    try {
      // 1. Fetch active instances from Evolution
      let evoInstances: any[] = [];
      try {
        const res = await this.client.get('/instance/fetchInstances');
        evoInstances = Array.isArray(res.data) ? res.data : [];
      } catch (err: any) {
        console.warn('[EVOLUTION-API] Could not fetch instances from Evolution API:', err.message);
      }

      // 2. Fetch configured terminals from local SQLite
      let query = 'SELECT * FROM whatsapp_terminals WHERE 1=1';
      const params: any[] = [];
      if (campaignId !== undefined && campaignId !== null) {
        query += ' AND (campaign_id = ? OR campaign_id IS NULL)';
        params.push(campaignId);
      }
      query += ' ORDER BY created_at DESC';

      const localTerminals = db.prepare(query).all(...params) as any[];

      // Ensure 'default' terminal exists in local DB
      if (localTerminals.length === 0 && (!campaignId || campaignId === null)) {
        try {
          db.prepare(`
            INSERT OR IGNORE INTO whatsapp_terminals (id, name, campaign_id, warmup_enabled)
            VALUES ('default', 'Terminal Principal', NULL, 0)
          `).run();
          return this.getTerminals(campaignId);
        } catch {}
      }

      const result: TerminalStatus[] = [];

      for (const t of localTerminals) {
        const instanceName = this.getInstanceName(t.id);
        const evoInst = evoInstances.find((i: any) => i.name === instanceName || i.name === t.id);

        let status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' = 'DISCONNECTED';
        let phone_number = t.phone_number || null;

        if (evoInst) {
          const conn = evoInst.connectionStatus || evoInst.state;
          if (conn === 'open' || conn === 'CONNECTED') {
            status = 'CONNECTED';
            if (evoInst.ownerJid) {
              phone_number = evoInst.ownerJid.split('@')[0];
            } else if (evoInst.number) {
              phone_number = evoInst.number;
            }
          } else if (conn === 'connecting' || conn === 'CONNECTING') {
            status = 'CONNECTING';
          }
        }

        result.push({
          id: t.id,
          name: t.name || `Terminal ${t.id}`,
          status,
          qr: null,
          phone_number,
          campaign_id: t.campaign_id,
          warmup_enabled: t.warmup_enabled || 0
        });
      }

      return result;
    } catch (err: any) {
      console.error('[EVOLUTION-API] Error listing terminals:', err.message);
      return [];
    }
  }

  async addTerminal(id: string, name: string, campaignId?: number | null): Promise<string | null> {
    const instanceName = this.getInstanceName(id);
    const webhookUrl = `${this.webhookBaseUrl}/api/whatsapp/webhook`;
    let qrFromCreate: string | null = null;

    try {
      const res = await this.client.post('/instance/create', {
        instanceName: instanceName,
        token: id,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: webhookUrl,
        webhook_by_events: false,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED'
        ]
      });

      const qr = res.data?.qrcode?.base64 || res.data?.base64 || res.data?.code || null;
      if (qr) {
        qrFromCreate = qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}`;
      }
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.data?.error?.includes('already in use') || err.response?.data?.response?.message?.includes('already in use')) {
        console.log(`[EVOLUTION-API] Instance ${instanceName} already exists in Evolution`);
      } else {
        console.warn(`[EVOLUTION-API] Instance creation notice for ${instanceName}:`, err.message);
      }
    }

    db.prepare(`
      INSERT INTO whatsapp_terminals (id, name, campaign_id, warmup_enabled)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, campaign_id = excluded.campaign_id
    `).run(id, name, campaignId || null);

    console.log(`[EVOLUTION-API] Terminal "${id}" (${name}) registered.`);
    return qrFromCreate;
  }

  async connect(terminalId: string): Promise<{ status: string; qr?: string | null; message?: string }> {
    const instanceName = this.getInstanceName(terminalId);
    
    // Ensure instance is created
    const qrFromCreate = await this.addTerminal(terminalId, terminalId);
    if (qrFromCreate) {
      return {
        status: 'CONNECTING',
        qr: qrFromCreate,
        message: 'Código QR generado. Escanéalo desde WhatsApp.'
      };
    }

    try {
      const res = await this.client.get(`/instance/connect/${instanceName}`);
      const data = res.data || {};

      let qr = data.base64 || data.qrcode?.base64 || data.code || null;
      if (qr && !qr.startsWith('data:image') && qr.length > 100) {
        qr = `data:image/png;base64,${qr}`;
      }

      if (data.instance?.state === 'open' || data.state === 'open') {
        return { status: 'CONNECTED', message: 'Terminal conectada' };
      }

      return {
        status: 'CONNECTING',
        qr: qr,
        message: 'Código QR generado. Escanéalo desde WhatsApp.'
      };
    } catch (err: any) {
      console.error(`[EVOLUTION-API] Error connecting terminal ${terminalId}:`, err.message);
      return { status: 'DISCONNECTED', message: err.message };
    }
  }

  async disconnect(terminalId: string): Promise<void> {
    const instanceName = this.getInstanceName(terminalId);
    try {
      await this.client.delete(`/instance/logout/${instanceName}`);
      console.log(`[EVOLUTION-API] Terminal ${terminalId} logged out.`);
    } catch (err: any) {
      console.warn(`[EVOLUTION-API] Error logging out terminal ${terminalId}:`, err.message);
    }
  }

  async deleteTerminal(terminalId: string): Promise<void> {
    const instanceName = this.getInstanceName(terminalId);
    try {
      await this.client.delete(`/instance/delete/${instanceName}`);
    } catch {}
    db.prepare('DELETE FROM whatsapp_terminals WHERE id = ?').run(terminalId);
  }

  getStatus(terminalId: string): TerminalStatus {
    const row = db.prepare('SELECT * FROM whatsapp_terminals WHERE id = ?').get(terminalId) as any;
    if (!row) {
      return {
        id: terminalId,
        name: terminalId,
        status: 'DISCONNECTED',
        qr: null,
        phone_number: null,
        campaign_id: null,
        warmup_enabled: 0
      };
    }

    return {
      id: row.id,
      name: row.name,
      status: 'DISCONNECTED',
      qr: null,
      phone_number: row.phone_number,
      campaign_id: row.campaign_id,
      warmup_enabled: row.warmup_enabled || 0
    };
  }

  // ── MESSAGE DISPATCHING & HELPER ALIASES ───────────────────────────────────

  getTerminalIds(): string[] {
    try {
      const rows = db.prepare('SELECT id FROM whatsapp_terminals').all() as any[];
      return rows.length > 0 ? rows.map(r => r.id) : ['default'];
    } catch {
      return ['default'];
    }
  }

  async checkNumberExists(terminalId: string, phone: string): Promise<{ exists: boolean; jid?: string }> {
    const instanceName = this.getInstanceName(terminalId);
    const targetNumber = this.cleanNumber(phone);
    try {
      const res = await this.client.post(`/chat/whatsappNumbers/${instanceName}`, {
        numbers: [targetNumber]
      });
      const data = res.data;
      const first = Array.isArray(data) ? data[0] : data;
      return { exists: first?.exists !== false, jid: first?.jid || `${targetNumber}@s.whatsapp.net` };
    } catch {
      return { exists: true, jid: `${targetNumber}@s.whatsapp.net` };
    }
  }

  async sendVoice(terminalId: string, to: string, audioUrl: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendMessage(terminalId, to, '', audioUrl, 'audio');
  }

  async sendLocation(terminalId: string, to: string, lat: number, lng: number, name?: string, address?: string): Promise<{ success: boolean; error?: string }> {
    return this.sendLocationMessage(terminalId, to, lat, lng, name || '', address || '');
  }

  async sendContact(terminalId: string, to: string, name: string, phone: string): Promise<{ success: boolean; error?: string }> {
    return this.sendContactMessage(terminalId, to, name, phone);
  }

  async sendMedia(terminalId: string, to: string, mediaUrl: string, caption?: string, mediaType: string = 'image'): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendMessage(terminalId, to, caption || '', mediaUrl, mediaType);
  }

  async sendMessage(
    terminalId: string,
    to: string,
    text: string,
    mediaUrl?: string | null,
    mediaType?: string | null,
    options?: { contactName?: string; campaignId?: number | null }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const instanceName = this.getInstanceName(terminalId);
    const targetNumber = this.cleanNumber(to);

    if (!targetNumber || targetNumber.length < 8) {
      return { success: false, error: 'Número de teléfono inválido' };
    }

    try {
      let res: any;

      if (mediaUrl) {
        let fullMediaUrl = mediaUrl;
        if (!fullMediaUrl.startsWith('http')) {
          fullMediaUrl = `${this.webhookBaseUrl}${fullMediaUrl.startsWith('/') ? '' : '/'}${fullMediaUrl}`;
        }

        let mType = (mediaType || 'image').toLowerCase();
        if (mType === 'photo') mType = 'image';
        if (mType === 'doc') mType = 'document';

        res = await this.client.post(`/message/sendMedia/${instanceName}`, {
          number: targetNumber,
          mediatype: mType,
          media: fullMediaUrl,
          caption: text || ''
        });
      } else {
        res = await this.client.post(`/message/sendText/${instanceName}`, {
          number: targetNumber,
          text: text,
          delay: 1200,
          linkPreview: true
        });
      }

      try {
        db.prepare(`
          INSERT INTO whatsapp_messages (terminal_id, contact_number, contact_name, body, type, is_incoming, campaign_id, phone_number, media_url)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
        `).run(
          terminalId,
          targetNumber,
          options?.contactName || null,
          text || '',
          mediaType || 'chat',
          options?.campaignId || null,
          targetNumber,
          mediaUrl || null
        );
      } catch (logErr: any) {
        console.warn('[EVOLUTION-API] Message logging error:', logErr.message);
      }

      return { success: true, messageId: res?.data?.key?.id || res?.data?.messageId };
    } catch (err: any) {
      const errorMsg = err.response?.data?.response?.message || err.response?.data?.message || err.message;
      console.error(`[EVOLUTION-API] Error sending message to ${targetNumber} via ${terminalId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async sendLocationMessage(
    terminalId: string,
    to: string,
    lat: number,
    lng: number,
    name: string,
    address?: string
  ): Promise<{ success: boolean; error?: string }> {
    const instanceName = this.getInstanceName(terminalId);
    const targetNumber = this.cleanNumber(to);

    try {
      await this.client.post(`/message/sendLocation/${instanceName}`, {
        number: targetNumber,
        latitude: lat,
        longitude: lng,
        name: name,
        address: address || ''
      });
      return { success: true };
    } catch (err: any) {
      console.error(`[EVOLUTION-API] Location send error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async sendContactMessage(
    terminalId: string,
    to: string,
    contactName: string,
    phoneNumber: string
  ): Promise<{ success: boolean; error?: string }> {
    const instanceName = this.getInstanceName(terminalId);
    const targetNumber = this.cleanNumber(to);
    const cleanContactPhone = this.cleanNumber(phoneNumber);

    try {
      await this.client.post(`/message/sendContact/${instanceName}`, {
        number: targetNumber,
        contact: [{
          fullName: contactName,
          wuid: `${cleanContactPhone}@s.whatsapp.net`,
          phoneNumber: cleanContactPhone
        }]
      });
      return { success: true };
    } catch (err: any) {
      console.error(`[EVOLUTION-API] Contact send error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // ── INBOUND WEBHOOK HANDLER ────────────────────────────────────────────────

  async handleWebhook(payload: any): Promise<void> {
    const event = payload?.event;
    const instance = payload?.instance;
    const terminalId = instance ? this.getTerminalIdFromInstance(instance) : 'default';

    if (event === 'MESSAGES_UPSERT' || event === 'messages.upsert') {
      const data = payload?.data;
      if (!data) return;

      const key = data.key || {};
      const fromMe = key.fromMe === true;
      const remoteJid = key.remoteJid || '';

      if (fromMe || remoteJid.includes('@g.us') || remoteJid.includes('broadcast') || remoteJid.includes('status@broadcast')) {
        return;
      }

      const messageObj = data.message || {};
      const messageText = 
        messageObj.conversation ||
        messageObj.extendedTextMessage?.text ||
        messageObj.imageMessage?.caption ||
        messageObj.videoMessage?.caption ||
        messageObj.documentMessage?.caption ||
        '';

      const contactNumber = remoteJid.split('@')[0];
      const pushName = data.pushName || null;

      try {
        db.prepare(`
          INSERT INTO whatsapp_messages (terminal_id, contact_number, contact_name, body, type, is_incoming, phone_number)
          VALUES (?, ?, ?, ?, 'chat', 1, ?)
        `).run(terminalId, contactNumber, pushName, messageText, contactNumber);
      } catch (err: any) {
        console.warn('[EVOLUTION-API] Webhook log error:', err.message);
      }

      if (messageText) {
        const senderAdapter = {
          sendMessage: async (jid: string, content: { text?: string }) => {
            if (content.text) {
              await this.sendMessage(terminalId, jid, content.text);
            }
          },
          sendPresenceUpdate: async (_status: string, _jid: string) => {}
        };

        try {
          await processIncomingMessage(senderAdapter, remoteJid, messageText, terminalId);
        } catch (autoErr: any) {
          console.error('[EVOLUTION-API] Autoresponder error:', autoErr.message);
        }
      }
    } else if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
      const state = payload?.data?.state;
      console.log(`[EVOLUTION-API] Connection update for ${instance}: ${state}`);
    }
  }
}

export const evolutionService = new EvolutionWhatsAppService();
export const whatsappService = evolutionService;
