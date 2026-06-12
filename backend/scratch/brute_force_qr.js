const zlib = require('zlib');
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

const qrData = "REC FAE19AAE7800C80000000013B96F3E789C636CBAC827BFA7406ADD2205050626061860F37163C9601201B21440821C0F4EA46830301C50022A01F29918941818548054829202440144A7020316A0A00056012240F2EF808A399AA48CA48200D8750CBEE002080D9989E065";
const hexPart = qrData.substring(4);
const zlibHeaderIdx = hexPart.toLowerCase().indexOf('789c');
const compressedBuf = Buffer.from(hexPart.substring(zlibHeaderIdx), 'hex');
const raw = zlib.inflateSync(compressedBuf);

// Get real candidate count
const listStructure = db.prepare(`
  SELECT num_lista as list_number, COUNT(DISTINCT ord_candidato) as candidate_count 
  FROM tsje_resultado_preferente 
  WHERE cod_eleccion = 45 AND cod_cargo = 4 AND cod_dpto = 0 AND cod_distrito = 0
  GROUP BY num_lista 
  ORDER BY CAST(num_lista AS INTEGER) ASC
`).all();

console.log("Structure:", listStructure);

// Expected list sums
const expected = {
  '1': 9,
  '3': 38,
  '9': 57,
  '13': 15,
  '21': 2,
  '25': 0,
  '100': 7
};

for (let bitWidth = 1; bitWidth <= 16; bitWidth++) {
  for (let bitOffset = 0; bitOffset < 256; bitOffset++) {
    try {
      let pos = bitOffset;
      const blancosVal = readBitsMSB(raw, pos, bitWidth);
      if (blancosVal !== 23) continue;
      
      let currentPos = pos + bitWidth;
      const votosMap = {};
      let matchesAll = true;
      
      for (const ls of listStructure) {
        let listSum = 0;
        const listVotes = [];
        for (let c = 0; c < ls.candidate_count; c++) {
          const v = readBitsMSB(raw, currentPos, bitWidth);
          currentPos += bitWidth;
          listSum += v;
          listVotes.push(v);
        }
        votosMap[ls.list_number] = { sum: listSum, votes: listVotes };
        if (listSum !== expected[ls.list_number]) {
          matchesAll = false;
          break;
        }
      }
      
      if (matchesAll) {
        console.log(`FOUND PARAMS! bitWidth=${bitWidth}, bitOffset=${bitOffset}`);
        console.log("Decoded values:");
        for (const [ln, data] of Object.entries(votosMap)) {
          console.log(`  List ${ln}: sum=${data.sum}, votes=[${data.votes.join(',')}]`);
        }
        return;
      }
    } catch (e) {
      // ignore
    }
  }
}
console.log("Done searching.");
