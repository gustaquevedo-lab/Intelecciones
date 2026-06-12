const axios = require('axios');
const Jimp = require('jimp').Jimp;
const jsQR = require('jsqr');
const zlib = require('zlib');

const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CERTIFICADO_ENDPOINT = `${TSJE_BASE}/dinamics/certificado.ajax.php`;

function readBitsMSB(buf, bitPos, width) {
  let val = 0;
  for (let b = 0; b < width; b++) {
    const pos = bitPos + b;
    const byteIdx = Math.floor(pos / 8);
    const bitIdx = 7 - (pos % 8);
    if (byteIdx < buf.length) val = (val << 1) | ((buf[byteIdx] >> bitIdx) & 1);
  }
  return val;
}

function decodeQr(qrData) {
  if (!qrData.startsWith('REC ')) return null;
  const hexPart = qrData.substring(4);
  const zlibHeaderIdx = hexPart.toLowerCase().indexOf('789c');
  if (zlibHeaderIdx === -1) return null;
  
  const prefixHex = hexPart.substring(0, zlibHeaderIdx);
  const prefixBuf = Buffer.from(prefixHex, 'hex');
  const cargoByte = prefixBuf.length >= 5 ? prefixBuf[4] : 0;
  const mesaId = prefixBuf.length >= 15 ? prefixBuf.slice(11, 15).toString('hex') : null;

  const compressedBuf = Buffer.from(hexPart.substring(zlibHeaderIdx), 'hex');
  const raw = zlib.inflateSync(compressedBuf);

  // Try 8-bit decode (shift-3)
  const shifted = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const curr = raw[i];
    const next = i + 1 < raw.length ? raw[i + 1] : 0;
    shifted[i] = ((curr << 3) | (next >> 5)) & 0xFF;
  }
  
  // Let's assume list size from the shifted buffer
  const blancos = shifted[8] ?? 0;
  const listVals = [];
  // For safety, let's scan all possible list values up to the end minus checksum byte
  const N = shifted.length - 10;
  for (let i = 0; i < N; i++) {
    listVals.push(shifted[9 + i] ?? 0);
  }
  const total = shifted[9 + listVals.length] ?? 0;
  const sum = listVals.reduce((a, b) => a + b, 0);
  const nulos = Math.max(0, total - blancos - sum);
  
  return {
    blancos,
    nulos,
    total,
    votosListas: listVals
  };
}

async function run() {
  try {
    console.log("Fetching certificate...");
    const res = await axios.get(CERTIFICADO_ENDPOINT, {
      params: {
        eleccion: 45,
        candidatura: 4,
        departamento: 13,
        distrito: 0,
        zona: '295',
        local: '2',
        mesa: '1',
        codigo: 53357707
      }
    });

    const officialDetails = res.data.detalle;
    const officialCabecera = res.data.cabecera;
    const base64Data = res.data.jpeg;

    console.log("Decoding QR from image...");
    const buffer = Buffer.from(base64Data, 'base64');
    const image = await Jimp.read(buffer);
    const rgbaData = new Uint8ClampedArray(image.bitmap.data);
    const code = jsQR(rgbaData, image.bitmap.width, image.bitmap.height);
    
    if (!code) {
      console.log("Could not detect QR code.");
      return;
    }

    console.log("QR Data:", code.data);
    const decoded = decodeQr(code.data);
    if (!decoded) {
      console.log("Could not decode QR data.");
      return;
    }

    console.log("\n=== COMPARA RESULTADOS ===");
    console.log("Cabecera Oficial vs QR:");
    console.log(`  Blancos: Oficial = ${officialCabecera.blancos}, QR = ${decoded.blancos}`);
    console.log(`  Nulos: Oficial = ${officialCabecera.nulos}, QR = ${decoded.nulos}`);
    console.log(`  Total: Oficial = ${officialCabecera.totProg}, QR = ${decoded.total}`);

    console.log("\nDetalle de Votos por Lista:");
    officialDetails.forEach((det, idx) => {
      // In the QR data, lists are ordered by their sequence in the shifted buffer.
      // Let's print the official votes and the decoded QR lists.
      console.log(`  Lista ${det.numLista} (${det.desPartido}): Oficial = ${det.votos}, QR index ${idx} = ${decoded.votosListas[idx]}`);
    });

  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
