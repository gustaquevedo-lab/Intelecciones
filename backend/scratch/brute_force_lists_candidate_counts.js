const zlib = require('zlib');
const qrData = "REC FAE19AAE7800C80000000013B96F3E789C636CBAC827BFA7406ADD2205050626061860F37163C9601201B21440821C0F4EA46830301C50022A01F29918941818548054829202440144A7020316A0A00056012240F2EF808A399AA48CA48200D8750CBEE002080D9989E065";
const hexPart = qrData.substring(4);
const zlibHeaderIdx = hexPart.toLowerCase().indexOf('789c');
const compressedBuf = Buffer.from(hexPart.substring(zlibHeaderIdx), 'hex');
const raw = zlib.inflateSync(compressedBuf);

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

const expectedSums = [9, 38, 57, 15, 2, 0, 7];

// Let's brute-force:
// 1. bitWidth: 1..8
// 2. bitOffset: 0..128
// 3. candidate count per list (could be 29 or 30 or similar)
// Let's assume all lists have the same number of candidate options, say K, where K is between 28 and 32.

for (let bitWidth = 3; bitWidth <= 6; bitWidth++) {
  for (let bitOffset = 0; bitOffset < 128; bitOffset++) {
    for (let K = 28; K <= 32; K++) {
      try {
        let pos = bitOffset;
        const blancos = readBitsMSB(raw, pos, bitWidth);
        if (blancos !== 23) continue;
        
        let currentPos = pos + bitWidth;
        const listSums = [];
        const listVotes = [];
        
        for (let l = 0; l < expectedSums.length; l++) {
          let sum = 0;
          const votes = [];
          for (let c = 0; c < K; c++) {
            const v = readBitsMSB(raw, currentPos, bitWidth);
            currentPos += bitWidth;
            sum += v;
            votes.push(v);
          }
          listSums.push(sum);
          listVotes.push(votes);
        }
        
        // Check if listSums matches expectedSums
        const match = listSums.every((s, i) => s === expectedSums[i]);
        if (match) {
          console.log(`FOUND EXACT MATCH: bitWidth=${bitWidth}, bitOffset=${bitOffset}, K=${K}`);
          listVotes.forEach((votes, idx) => {
            console.log(`  List index ${idx}: votes = [${votes.join(',')}]`);
          });
          return;
        }
      } catch (e) {
        // ignore
      }
    }
  }
}
console.log("Done search.");
