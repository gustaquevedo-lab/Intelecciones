const zlib = require('zlib');

function getBytes(qrRaw) {
  const hexPart = qrRaw.substring(4).trim();
  const zlibIdx = hexPart.toLowerCase().indexOf('789c');
  const prefixBuf = Buffer.from(hexPart.substring(0, zlibIdx), 'hex');
  const raw = zlib.inflateSync(Buffer.from(hexPart.substring(zlibIdx), 'hex'));
  return { prefixBuf, raw };
}

// Read N-bit values sequentially from a byte buffer starting at given bit offset
function readBits(buf, startBit, count) {
  let result = 0;
  for (let i = 0; i < count; i++) {
    const byteIdx = Math.floor((startBit + i) / 8);
    const bitIdx  = 7 - ((startBit + i) % 8);
    const bit     = byteIdx < buf.length ? (buf[byteIdx] >> bitIdx) & 1 : 0;
    result = (result << 1) | bit;
  }
  return result;
}

// Junta: 12 options for L3 = [5,2,19,0,6,2,5,2,4,0,2,0], blancos=11, total=151
// Other lists also present (sum=47, missing 93 votes for other lists)
// Let's try reading 7-bit values (max 127 fits) or 8-bit starting from different offsets

const junta = getBytes('REC FAAA26CE2B008800000000D5E9A780789C636CBAC813E011C0D6B7CC68150BE3AF60AF8C6B075C041A1D041CE51B1818190C19321A2C14B4040C26489C000039E60D4AE002080D99890733');
const jRaw = junta.raw;

console.log('=== JUNTA - Full raw bytes ===');
console.log(Array.from(jRaw));

// The key insight: for Junta the data payload encodes votes for EACH CANDIDATE within each list,
// not just list totals. So for 12-member Junta lists, we'd need positions per member per list.
// Let's look for the sequence 5,2,19,0,6,2,5,2,4,0,2,0 anywhere in the raw data
console.log('\n=== Searching for L3 candidate sequence [5,2,19,0,6,2,5,2,4,0,2,0] ===');
const target = [5, 2, 19, 0, 6, 2, 5, 2, 4, 0, 2, 0];
for (let start = 0; start <= jRaw.length - 12; start++) {
  const match = target.every((v, i) => jRaw[start + i] === v);
  if (match) console.log(`  Found exact match at byte offset ${start}!`);
}

// Try 6-bit packed values (values 0-63 cover all typical vote counts)
console.log('\n=== Trying 6-bit packed read for [5,2,19,0,6,2,5,2,4,0,2,0] ===');
for (let startBit = 0; startBit <= 48; startBit++) {
  const vals = [];
  for (let i = 0; i < 12; i++) {
    vals.push(readBits(jRaw, startBit + i * 6, 6));
  }
  if (vals[0] === 5 && vals[1] === 2 && vals[2] === 19) {
    console.log(`  6-bit MATCH at startBit=${startBit}: ${vals.join(',')}`);
  }
}

// Try 7-bit packed
console.log('\n=== Trying 7-bit packed read for [5,2,19,0,6,2,5,2,4,0,2,0] ===');
for (let startBit = 0; startBit <= 56; startBit++) {
  const vals = [];
  for (let i = 0; i < 12; i++) {
    vals.push(readBits(jRaw, startBit + i * 7, 7));
  }
  if (vals[0] === 5 && vals[1] === 2 && vals[2] === 19) {
    console.log(`  7-bit MATCH at startBit=${startBit}: ${vals.join(',')}`);
  }
}

// Try 8-bit packed at various offsets
console.log('\n=== Trying 8-bit read for [5,2,19,0,6,2,5,2,4,0,2,0] ===');
for (let offset = 0; offset <= jRaw.length - 12; offset++) {
  if (jRaw[offset] === 5 && jRaw[offset+1] === 2 && jRaw[offset+2] === 19) {
    console.log(`  8-bit sequence starts at offset=${offset}: ${Array.from(jRaw.slice(offset, offset+12)).join(',')}`);
  }
}

// Maybe the total 151 is 0x97=151 - search in raw
console.log('\n=== Raw bytes equal to key values ===');
for (let i = 0; i < jRaw.length; i++) {
  const v = jRaw[i];
  if (v === 151 || v === 11 || v === 47 || v === 93) {
    console.log(`  raw[${i}] = ${v} (151=total, 11=blancos, 47=sumL3, 93=otherLists?)`);
  }
}

// Now also look at Convencional and cross-correlate
// The Convencional data after shift3 shows byte8=15, bytes9-11=98,21,1, total=?
// Since Convencional is a single-member election (like Intendente),
// the 3 lists are still L3, L9, L100 with totals per list.
// 15+98+21+1 = 135, but mesa total should be 151 (same mesa).
// WAIT: 15 blancos + 98+21+1 listas + ??? nulos = 151? That means 16 nulos.
// Let me check the shifted Convencional more carefully for the total position.

console.log('\n=== CONVENCIONAL - where is total 151? ===');
const conv = getBytes('REC FABC4A5964008000000000D5E9A780789C636CBAC8AFFC2380F5E01BA7050A61CA5BBB1688357A1878A8D4313008301C6262644C6C0C6958E700001FF90D4EE002080D99890733');
const cRaw = conv.raw;
const cShift = Buffer.alloc(cRaw.length);
for (let i = 0; i < cRaw.length; i++) {
  const curr = cRaw[i];
  const next = i + 1 < cRaw.length ? cRaw[i + 1] : 0;
  cShift[i] = ((curr << 3) | (next >> 5)) & 0xFF;
}
console.log('Shifted:', Array.from(cShift));
// Check if 151 is hidden as two-byte little-endian or big-endian
for (let i = 0; i < cRaw.length - 1; i++) {
  const le = cRaw[i] + cRaw[i+1] * 256;
  const be = cRaw[i] * 256 + cRaw[i+1];
  if (le === 151 || be === 151) console.log(`  Two-byte 151 at raw[${i}..${i+1}]: LE=${le} BE=${be}`);
}
// Sum check: blancos(15) + L3(98) + L9(21) + L100(1) = 135. 
// If nulos were stored at byte[12] shifted = 2, then 135+2 = 137 ≠ 151
// But byte[12]=2, byte[13]=177...
// What if total is 2-byte value at [12,13]? 2 + 177*256 = 45314. No.
// 177*256 + 2 = 45314. No.
// What if byte[13]=177 is irrelevant and the total is encoded in big-endian uint16?
// Actually blancos=15, 151-15=136, and sum of other bytes near 136?
// byte9+byte10+byte11 = 98+21+1=120. 151-15-120=16. Is 16 the nulos?
// 16 = byte[12]=2? No. Maybe it's at position after the list votes ends
// byte[12]=2 could be something, then nulos=16 stored elsewhere.
// Let me check: 8-bit read of bytes starting at 9:
console.log('Convencional raw:', Array.from(cRaw));
for (let i = 0; i < cRaw.length; i++) {
  if (cRaw[i] === 16 || cRaw[i] === 136 || cRaw[i] === 151 || cRaw[i] === 15) {
    console.log(`  raw[${i}] = ${cRaw[i]} (15=blancos, 16=nulos?, 136=l3+l9+l100, 151=total)`);
  }
}
