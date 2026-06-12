const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));
const zlib = require('zlib');

function readBitsMSB(buf, bitPos, width) {
  let val = 0;
  for (let b = 0; b < width; b++) {
    const pos = bitPos + b;
    const byteIdx = Math.floor(pos / 8);
    const bitIdx = 7 - (pos % 8);
    if (byteIdx < buf.length) val = (val << 1) | ((buf[byteIdx] & (1 << bitIdx)) ? 1 : 0);
  }
  return val;
}

async function run() {
  const qrData = "REC FAE19AAE7800C80000000013B96F3E789C636CBAC827BFA7406ADD2205050626061860F37163C9601201B21440821C0F4EA46830301C50022A01F29918941818548054829202440144A7020316A0A00056012240F2EF808A399AA48CA48200D8750CBEE002080D9989E065";
  
  const hexPart = qrData.substring(4);
  const zlibHeaderIdx = hexPart.toLowerCase().indexOf('789c');
  const compressedBuf = Buffer.from(hexPart.substring(zlibHeaderIdx), 'hex');
  const raw = zlib.inflateSync(compressedBuf);

  // Let's get the candidate count per list for cargo 4 from tsje_resultado_preferente
  // We have the national consolidated results (cod_dpto = 0, cod_distrito = 0)
  const listStructure = db.prepare(`
    SELECT num_lista as list_number, COUNT(DISTINCT ord_candidato) as candidate_count 
    FROM tsje_resultado_preferente 
    WHERE cod_eleccion = 45 AND cod_cargo = 4 AND cod_dpto = 0 AND cod_distrito = 0
    GROUP BY num_lista 
    ORDER BY CAST(num_lista AS INTEGER) ASC
  `).all();
  
  console.log("Real TSJE Lists structure for cargo 4:", listStructure);
  
  if (listStructure.length === 0) {
    console.log("No candidates found in tsje_resultado_preferente for cargo 4. Make sure you synced cargo 4 first.");
    return;
  }
  
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
            const candidateVotes = [];
            for (let c = 0; c < ls.candidate_count; c++) {
              const v = readBitsMSB(raw, pos, bitWidth);
              pos += bitWidth;
              if (v > 5000) { invalid = true; break; }
              candidateVotes.push(v);
              listSum += v;
            }
            if (invalid) break;
            votosMap[ls.list_number] = { listSum, candidateVotes };
            overallSum += listSum;
          }
          if (invalid) continue;
          const total = blancosVal + overallSum;
          
          // Let's compare with official totals of this mesa:
          // Official totals: Blancos = 23, Total = 151
          // Official list totals: L1=9, L3=38, L9=57, L13=15, L21=2, L25=0, L100=7
          // Total list votes sum = 9+38+57+15+2+0+7 = 128.
          // Blancos + List votes = 23 + 128 = 151.
          if (total === 151 && blancosVal === 23) {
            console.log(`\nSUCCESSFULLY DECODED! bitWidth=${bitWidth}, bitOffset=${bitOffset}`);
            console.log("Blancos:", blancosVal);
            console.log("Total:", total);
            console.log("\nDecoded votes per list and candidate option:");
            for (const [ln, val] of Object.entries(votosMap)) {
              console.log(`  List ${ln}: Total = ${val.listSum}, Options = [${val.candidateVotes.join(',')}]`);
            }
            return;
          }
        } catch (e) {
          // ignore
        }
      }
    }
    console.log("Could not find matching bitfield decoding parameters.");
  };
  
  tryDecodeBitfields();
}
run();
