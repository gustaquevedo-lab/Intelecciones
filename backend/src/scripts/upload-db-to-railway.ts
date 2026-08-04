import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';

const TARGET_URL = process.env.RAILWAY_URL || 'https://intelecciones-production.up.railway.app/api/admin/system/upload-database';
const DB_PATH = path.join(process.cwd(), 'backend', 'intellecciones.db');

async function uploadDb() {
  const fileToUpload = fs.existsSync(DB_PATH) ? DB_PATH : path.join(process.cwd(), 'intellecciones.db');
  if (!fs.existsSync(fileToUpload)) {
    console.error('ERROR: No se encontró intellecciones.db local en:', fileToUpload);
    process.exit(1);
  }

  const stat = fs.statSync(fileToUpload);
  console.log(`Subiendo base de datos local (${(stat.size / 1024 / 1024).toFixed(2)} MB) a Railway...`);
  console.log(`Destino: ${TARGET_URL}`);

  const form = new FormData();
  form.append('database', fs.createReadStream(fileToUpload));

  try {
    const res = await axios.post(TARGET_URL, form, {
      headers: {
        ...form.getHeaders(),
        'x-user-role': 'SUPERUSUARIO'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000 // 5 minutes
    });

    console.log('✅ ÉXITO EN SINCRONIZACIÓN DE PRODUCCIÓN:', res.data);
  } catch (err: any) {
    console.error('❌ ERROR AL SUBIR BASE DE DATOS A RAILWAY:', err.response?.data || err.message);
    process.exit(1);
  }
}

uploadDb();
