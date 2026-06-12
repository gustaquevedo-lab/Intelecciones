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

  // Let's force candidate count to be exactly 30 for all lists
  const listStructure = [
    { list_number: '1', candidate_count: 30 },
    { list_number: '3', candidate_count: 30 },
    { list_number: '9', candidate_count: 30 },
    { list_number: '13', candidate_count: 30 },
    { list_number: '21', candidate_count: 30 },
    { list_number: '25', candidate_count: 30 },
    { list_number: '100', candidate_count: 30 }
  ];
  
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
          
          if (total === 151 && blancosVal === 23) {
            console.log(`\nSUCCESSFULLY DECODED WITH FORCED 30! bitWidth=${bitWidth}, bitOffset=${bitOffset}`);
            console.log("Blancos:", blancosVal);
            console.log("Total:", total);
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
