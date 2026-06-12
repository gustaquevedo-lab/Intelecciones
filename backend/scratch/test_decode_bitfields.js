const axios = require('axios');
const Jimp = require('jimp').Jimp;
const jsQR = require('jsqr');
const zlib = require('zlib');

// Database lookup for list structure of cargo 4
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

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

async function run() {
  const qrData = "REC FAE19AAE7800C80000000013B96F3E789C636CBAC827BFA7406ADD2205050626061860F37163C9601201B21440821C0F4EA46830301C50022A01F29918941818548054829202440144A7020316A0A00056012240F2EF808A399AA48CA48200D8750CBEE002080D9989E065";
  
  const hexPart = qrData.substring(4);
  const zlibHeaderIdx = hexPart.toLowerCase().indexOf('789c');
  const compressedBuf = Buffer.from(hexPart.substring(zlibHeaderIdx), 'hex');
  const raw = zlib.inflateSync(compressedBuf);

  // We need the list count and candidates count for cargo 4 (Directorio Nacional)
  // Directorio Nacional is mapped to type 'AUTORIDADES' in parse-qr
  const listStructure = db.prepare(`
    SELECT list_number, COUNT(*) as candidate_count 
    FROM lists 
    WHERE type = 'AUTORIDADES' 
    GROUP BY list_number 
    ORDER BY CAST(list_number AS INTEGER) ASC
  `).all();
  
  console.log("Lists structure:", listStructure);
  
  const tryDecodeBitfields = () => {
    const MAX_TOTAL = 10000;
    for (let bitWidth = 1; bitWidth <= 12; bitWidth++) {
      for (let bitOffset = 0; bitOffset < 128; bitOffset += 1) {
        try {
          let pos = bitOffset;
          const blancosVal = readBitsMSB(raw, pos, bitWidth);
          if (blancosVal > 5000) continue;
          pos += bitWidth;
          const votosMap = {};
          let overallSum = 0;
          let invalid = false;
          for (const ls of listStructure) {
            let listSum = 0;
            for (let c = 0; c < ls.candidate_count; c++) {
              const v = readBitsMSB(raw, pos, bitWidth);
              pos += bitWidth;
              if (v > 5000) { invalid = true; break; }
              listSum += v;
            }
            if (invalid) break;
            votosMap[ls.list_number] = listSum;
            overallSum += listSum;
          }
          if (invalid) continue;
          const total = blancosVal + overallSum;
          if (total <= 0 || total > MAX_TOTAL) continue;
          
          // Let's print potential candidates if they are close to the official ones
          // Official: Blancos = 23, total = 151
          // Lists: L1=9, L3=38, L9=57, L13=15, L21=2, L25=0, L100=7
          if (total === 151 && blancosVal === 23) {
            console.log(`FOUND MATCH! bitWidth=${bitWidth}, bitOffset=${bitOffset}`);
            console.log("Decoded votos:", votosMap);
            return;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  };
  
  tryDecodeBitfields();
}
run();
