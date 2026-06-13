import axios from 'axios';

export interface GeminiOCRResult {
  success: boolean;
  blancos: number;
  nulos: number;
  votos: Record<string, number>;
  preferentes: Record<string, number>;
  error?: string;
}

export async function processActaWithGemini(
  imageBuffer: Buffer,
  cargoName: string
): Promise<GeminiOCRResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[GEMINI SERVICE] GEMINI_API_KEY is not defined in environment variables');
    return {
      success: false,
      blancos: 0,
      nulos: 0,
      votos: {},
      preferentes: {},
      error: 'GEMINI_API_KEY no configurado en el servidor'
    };
  }

  const base64Data = imageBuffer.toString('base64');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Analiza esta imagen de un acta electoral del TSJE de Paraguay para la candidatura: "${cargoName}". 
Extrae los votos en blanco, los votos nulos, los totales de cada lista y los votos preferenciales de cada candidato (opción).
Es muy importante que seas sumamente preciso y que verifiques que la suma de los votos preferenciales coincida con el total de cada lista, y que la suma de todos coincida con el total de la mesa.

Devuelve únicamente un objeto JSON con el siguiente formato, sin markdown ni explicaciones:
{
  "blancos": <número_votos_blancos>,
  "nulos": <número_votos_nulos>,
  "votos": {
    "<num_lista>": <votos_totales_de_la_lista>
  },
  "preferentes": {
    "<num_lista>_<ord_candidato>": <votos_del_candidato>
  }
}`;

  try {
    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 90000 // 90 seconds timeout (to support slow image analysis)
      }
    );

    const textResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('No se recibió texto de respuesta desde la API de Gemini');
    }

    const parsed = JSON.parse(textResponse.trim());
    return {
      success: true,
      blancos: parsed.blancos || 0,
      nulos: parsed.nulos || 0,
      votos: parsed.votos || {},
      preferentes: parsed.preferentes || {}
    };
  } catch (err: any) {
    console.error('[GEMINI OCR ERROR]', err.response?.data || err.message || err);
    return {
      success: false,
      blancos: 0,
      nulos: 0,
      votos: {},
      preferentes: {},
      error: err.message || 'Error al invocar la API de Gemini'
    };
  }
}
