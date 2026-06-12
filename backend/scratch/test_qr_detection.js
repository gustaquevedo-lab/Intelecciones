const axios = require('axios');
const Jimp = require('jimp').Jimp; // Jimp v1 uses .Jimp or import { Jimp } from 'jimp'
const jsQR = require('jsqr');

const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CERTIFICADO_ENDPOINT = `${TSJE_BASE}/dinamics/certificado.ajax.php`;

async function run() {
  try {
    console.log("Fetching certificate JPEG...");
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
    
    const base64Data = res.data.jpeg;
    if (!base64Data) {
      console.log("No JPEG found in response.");
      return;
    }
    
    console.log("Decoding JPEG with Jimp...");
    const buffer = Buffer.from(base64Data, 'base64');
    const image = await Jimp.read(buffer);
    
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const rgbaData = new Uint8ClampedArray(image.bitmap.data);
    
    console.log(`Image size: ${width}x${height}`);
    console.log("Scanning for QR code...");
    const code = jsQR(rgbaData, width, height);
    
    if (code) {
      console.log("QR Code detected successfully!");
      console.log("Data snippet:", code.data.substring(0, 100));
      console.log("Full data:", code.data);
    } else {
      console.log("No QR Code detected in the image.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
