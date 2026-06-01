import db from './db';
import { normalizePhone } from './utils/phone';

// Ensure opt-out table exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_optouts (
      phone TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch (err) {
  console.error('[AUTORESPONDER] Error creating whatsapp_optouts table:', err);
}

interface ElectorInfo {
  ci: string;
  nombre: string;
  apellido: string;
  local_votacion: string;
  mesa: number;
  orden: number;
  distrito: string;
  ciudad: string;
}

/**
 * Normalizes a phone number to standard format digits
 */
function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Checks if a phone number is in the opt-out list
 */
export function isOptedOut(phone: string): boolean {
  const clean = cleanPhone(phone);
  try {
    const row = db.prepare('SELECT 1 FROM whatsapp_optouts WHERE phone = ?').get(clean);
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Adds a phone number to the opt-out list
 */
export function addOptOut(phone: string): void {
  const clean = cleanPhone(phone);
  try {
    db.prepare('INSERT OR IGNORE INTO whatsapp_optouts (phone) VALUES (?)').run(clean);
    console.log(`[AUTORESPONDER] Number ${clean} added to opt-out list.`);
  } catch (err) {
    console.error('[AUTORESPONDER] Error adding opt-out:', err);
  }
}

/**
 * Finds elector details associated with a phone number
 */
function findElectorByPhone(phone: string): ElectorInfo | null {
  const hash = normalizePhone(phone);
  if (!hash) return null;

  try {
    // 1. Search in elector_captures
    const elector = db.prepare(`
      SELECT e.ci, e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden, e.distrito, e.ciudad
      FROM electors e
      JOIN elector_captures ec ON e.ci = ec.elector_ci
      WHERE ec.phone_hash = ?
      LIMIT 1
    `).get(hash) as ElectorInfo | undefined;

    if (elector) return elector;

    // 2. Search in users (coordinators might also check)
    const user = db.prepare(`
      SELECT ci, nombre, '' as apellido, distrito
      FROM users
      WHERE phone_hash = ?
      LIMIT 1
    `).get(hash) as any;

    if (user && user.ci) {
      const electorFromCi = db.prepare(`
        SELECT ci, nombre, apellido, local_votacion, mesa, orden, distrito, ciudad
        FROM electors
        WHERE ci = ?
        LIMIT 1
      `).get(user.ci) as ElectorInfo | undefined;
      
      if (electorFromCi) return electorFromCi;

      // Fallback if user exists but not in electors list
      return {
        ci: user.ci,
        nombre: user.nombre,
        apellido: '',
        local_votacion: 'No especificado',
        mesa: 0,
        orden: 0,
        distrito: user.distrito || '',
        ciudad: ''
      };
    }
  } catch (err) {
    console.error('[AUTORESPONDER] Error querying database for phone:', phone, err);
  }
  return null;
}

/**
 * Automatically processes incoming messages and sends replies if keywords match
 */
export async function processIncomingMessage(
  sock: any,
  fromJid: string,
  messageText: string,
  terminalId: string
): Promise<boolean> {
  const phone = fromJid.split('@')[0];
  const text = messageText.trim().toLowerCase();
  
  if (!text) return false;

  // Check if sender is another connected terminal with warmup enabled
  try {
    const isWarmupPartner = db.prepare('SELECT 1 FROM whatsapp_terminals WHERE phone_number = ? AND warmup_enabled = 1').get(phone);
    if (isWarmupPartner) {
      if (Math.random() < 0.15) {
        console.log(`[AUTORESPONDER][WARMUP] Stopping warm-up conversation with ${phone} randomly to mimic human behavior`);
        return true;
      }

      const WARMUP_REPLIES = [
        '¡Genial! Gracias por avisar.',
        'Entendido, quedamos así.',
        'Dale, perfecto.',
        'Buenísimo, seguimos al habla.',
        '¡Excelente! Un abrazo.',
        'Dale, nos vemos más tarde.',
        'Listo, cualquier novedad aviso.',
        '¡Qué bueno! Éxitos hoy.',
        'Sí, totalmente de acuerdo.',
        'Dale, te aviso apenas tenga novedades.',
        'Buen día, todo bien por suerte.',
        '¡Hola! Avanzando a full.',
        'Excelente, fuerza equipo.',
        'Gracias por la actualización.'
      ];

      const reply = WARMUP_REPLIES[Math.floor(Math.random() * WARMUP_REPLIES.length)];
      const delayMs = 5000 + Math.random() * 7000;
      console.log(`[AUTORESPONDER][WARMUP] Warm-up message from ${phone}. Scheduling reply in ${(delayMs/1000).toFixed(1)}s`);
      
      setTimeout(async () => {
        try {
          await sock.sendPresenceUpdate('composing', fromJid);
          await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
          await sock.sendPresenceUpdate('paused', fromJid);
          
          await sock.sendMessage(fromJid, { text: reply });
          db.prepare(`
            INSERT INTO whatsapp_messages (terminal_id, contact_number, body, type, is_incoming, campaign_id, phone_number)
            VALUES (?, ?, ?, 'chat', 0, null, ?)
          `).run(terminalId, fromJid, reply, phone);
        } catch (e: any) {
          console.error(`[AUTORESPONDER][WARMUP] Failed sending reply to warmup partner ${phone}:`, e.message);
        }
      }, delayMs);

      return true;
    }
  } catch (err: any) {
    console.error('[AUTORESPONDER][WARMUP] Error checking warmup partner:', err.message);
  }

  // 1. Keyword check for Opt-out / Baja
  const optOutKeywords = ['baja', 'no enviar', 'no me escriban', 'no molestar', 'remover', 'salir', 'stop', 'no quiero recibir'];
  if (optOutKeywords.some(keyword => text.includes(keyword))) {
    addOptOut(phone);
    try {
      await sock.sendMessage(fromJid, {
        text: 'Lamentamos las molestias. Hemos registrado tu solicitud y hemos removido tu número de nuestras listas de difusión automática.'
      });
      return true;
    } catch (err) {
      console.error('[AUTORESPONDER] Error sending opt-out response:', err);
    }
  }

  // Check if phone is already opted out, do not respond further to avoid spamming
  if (isOptedOut(phone)) {
    return false;
  }

  // Find associated elector
  const elector = findElectorByPhone(phone);
  const displayName = elector ? `${elector.nombre}` : 'Amigo/a';

  // 2. Keyword check for voting location / padron
  const votingKeywords = ['donde voto', 'dónde voto', 'donde votar', 'dónde votar', 'mi mesa', 'consulta', 'consultar', 'padron', 'padrón', 'en que mesa', 'lugar de votacion'];
  if (votingKeywords.some(keyword => text.includes(keyword))) {
    if (elector) {
      const reply = `¡Hola ${displayName}! 🇵🇾
Tus datos para votar son los siguientes:

📍 *Local de Votación:* ${elector.local_votacion}
🗳️ *Mesa:* ${elector.mesa}
🔢 *Número de Orden:* ${elector.orden}
${elector.distrito ? `🏙️ *Distrito:* ${elector.distrito}` : ''}

¡Tu participación es muy importante! Si necesitas ayuda para llegar a tu local de votación, escríbenos la palabra *transporte*.`;

      try {
        await sock.sendMessage(fromJid, { text: reply });
        return true;
      } catch (err) {
        console.error('[AUTORESPONDER] Error sending voting data reply:', err);
      }
    } else {
      // Elector not found
      try {
        await sock.sendMessage(fromJid, {
          text: `Hola. No encontramos tu número de teléfono registrado en nuestro padrón de campaña. Si deseas consultar tu lugar de votación, por favor respóndenos enviando tu número de Cédula de Identidad (CI) sin puntos.`
        });
        return true;
      } catch (err) {
        console.error('[AUTORESPONDER] Error sending elector not found reply:', err);
      }
    }
  }

  // 3. Match pure Cédula de Identidad (numeric string between 5 and 8 digits)
  const ciMatch = text.replace(/\./g, '').trim();
  if (/^\d{5,8}$/.test(ciMatch)) {
    try {
      const electorByCi = db.prepare(`
        SELECT ci, nombre, apellido, local_votacion, mesa, orden, distrito, ciudad
        FROM electors
        WHERE ci = ?
        LIMIT 1
      `).get(ciMatch) as ElectorInfo | undefined;

      if (electorByCi) {
        const reply = `¡Datos encontrados! 🇵🇾
Elector: *${electorByCi.nombre} ${electorByCi.apellido || ''}*

📍 *Local de Votación:* ${electorByCi.local_votacion}
🗳️ *Mesa:* ${electorByCi.mesa}
🔢 *Número de Orden:* ${electorByCi.orden}
${electorByCi.distrito ? `🏙️ *Distrito:* ${electorByCi.distrito}` : ''}

Si necesitas traslado para el día de las elecciones, escribe la palabra *transporte*.`;
        
        await sock.sendMessage(fromJid, { text: reply });
        return true;
      } else {
        await sock.sendMessage(fromJid, {
          text: `No encontramos ningún elector registrado con la Cédula de Identidad N° ${ciMatch}. Por favor verifica que el número sea correcto.`
        });
        return true;
      }
    } catch (err) {
      console.error('[AUTORESPONDER] Error searching elector by CI:', ciMatch, err);
    }
  }

  // 4. Keyword check for transport request
  const transportKeywords = ['transporte', 'colectivo', 'vehiculo', 'vehículo', 'auto', 'movil', 'móvil', 'llevar', 'viaje', 'necesito movil', 'necesito móvil', 'busco pasaje'];
  if (transportKeywords.some(keyword => text.includes(keyword))) {
    if (elector) {
      try {
        // Update needs_transport = 1 in elector_captures for this elector
        const result = db.prepare(`
          UPDATE elector_captures 
          SET needs_transport = 1, transport_status = 'PENDING'
          WHERE elector_ci = ?
        `).run(elector.ci);

        const reply = `¡Excelente, ${displayName}! 🚗
He registrado tu solicitud de transporte en el sistema. 

El día de las elecciones, un coordinador de nuestro equipo se pondrá en contacto contigo a este número para organizar tu traslado a *${elector.local_votacion}*. ¡Muchas gracias!`;

        await sock.sendMessage(fromJid, { text: reply });
        console.log(`[AUTORESPONDER] Registered transport request for elector: ${elector.ci} (Rows updated: ${result.changes})`);
        return true;
      } catch (err) {
        console.error('[AUTORESPONDER] Error registering transport request:', err);
      }
    } else {
      // Elector not found but requests transport
      try {
        await sock.sendMessage(fromJid, {
          text: `Hola. Para poder coordinar tu transporte, necesitamos saber tus datos. Por favor, indícanos tu número de Cédula de Identidad (CI) sin puntos para registrar tu solicitud.`
        });
        return true;
      } catch (err) {
        console.error('[AUTORESPONDER] Error sending transport reply for unregistered phone:', err);
      }
    }
  }

  // If no keywords match, return false so the message can be handled manually or ignored
  return false;
}
