import { createWorker } from 'tesseract.js';

export interface OCRResult {
  mesa: number | null;
  local: string | null;
  distrito: string | null;
  departamento: string | null;
  blancos: number | null;
  nulos: number | null;
  total: number | null;
  rawText: string;
}

export async function processActaImage(imageBuffer: Buffer): Promise<OCRResult> {
  // Initialize Tesseract worker in Spanish
  const worker = await createWorker('spa');

  try {
    const { data: { text } } = await worker.recognize(imageBuffer);

    // Basic extraction heuristics
    let mesa: number | null = null;
    let local: string | null = null;
    let distrito: string | null = null;
    let departamento: string | null = null;
    let blancos: number | null = null;
    let nulos: number | null = null;
    let total: number | null = null;

    // Parse line by line
    const lines = text.split('\n');
    for (const line of lines) {
      const upperLine = line.toUpperCase();

      // Parse Mesa
      if (upperLine.includes('MESA:')) {
        const match = line.match(/MESA:\s*(\d+)/i);
        if (match) mesa = parseInt(match[1]);
      }

      // Parse Departamento
      if (upperLine.includes('DEPTO:') || upperLine.includes('DEPARTAMENTO:')) {
        const match = line.match(/(?:DEPTO|DEPARTAMENTO):\s*([^-]+)-(.*)/i);
        if (match) {
          departamento = match[2].trim();
        } else {
          const simpleMatch = line.match(/(?:DEPTO|DEPARTAMENTO):\s*(.*)/i);
          if (simpleMatch) departamento = simpleMatch[1].trim();
        }
      }

      // Parse Distrito
      if (upperLine.includes('DISTRITO:')) {
        const match = line.match(/DISTRITO:\s*([^-]+)-(.*)/i);
        if (match) {
          distrito = match[2].trim();
        } else {
          const simpleMatch = line.match(/DISTRITO:\s*(.*)/i);
          if (simpleMatch) distrito = simpleMatch[1].trim();
        }
      }

      // Parse Local
      if (upperLine.includes('LOCAL:')) {
        const match = line.match(/LOCAL:\s*(.*)/i);
        if (match) local = match[1].trim();
      }

      // Parse Blancos
      if (upperLine.includes('BLANCO')) {
        const match = line.match(/(\d+)/);
        if (match) blancos = parseInt(match[1]);
      }

      // Parse Nulos
      if (upperLine.includes('NULO')) {
        const match = line.match(/(\d+)/);
        if (match) nulos = parseInt(match[1]);
      }

      // Parse Total
      if (upperLine.includes('TOTAL GENERAL')) {
        const match = line.match(/(\d+)/);
        if (match) total = parseInt(match[1]);
      }
    }

    return {
      mesa,
      local,
      distrito,
      departamento,
      blancos,
      nulos,
      total,
      rawText: text
    };
  } finally {
    await worker.terminate();
  }
}
