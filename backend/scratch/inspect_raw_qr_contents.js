const zlib = require('zlib');

const qrData = "REC FAE19AAE7800C80000000013B96F3E789C636CBAC827BFA7406ADD2205050626061860F37163C9601201B21440821C0F4EA46830301C50022A01F29918941818548054829202440144A7020316A0A00056012240F2EF808A399AA48CA48200D8750CBEE002080D9989E065";

const hexPart = qrData.substring(4);
const zlibHeaderIdx = hexPart.toLowerCase().indexOf('789c');
const prefixHex = hexPart.substring(0, zlibHeaderIdx);
const prefixBuf = Buffer.from(prefixHex, 'hex');
console.log("Prefix hex:", prefixHex);
console.log("Prefix len:", prefixBuf.length);
console.log("Prefix details:");
console.log("  Mesa ID (hex):", prefixBuf.slice(11, 15).toString('hex'));
console.log("  Cargo Byte:", prefixBuf.length >= 5 ? prefixBuf[4].toString(16) : null);

const compressedBuf = Buffer.from(hexPart.substring(zlibHeaderIdx), 'hex');
const raw = zlib.inflateSync(compressedBuf);
console.log("Inflated buffer length:", raw.length);
console.log("Inflated buffer hex:", raw.toString('hex'));
console.log("Inflated buffer bytes:", Array.from(raw));

// Shift-3 decode
const shifted = Buffer.alloc(raw.length);
for (let i = 0; i < raw.length; i++) {
  const curr = raw[i];
  const next = i + 1 < raw.length ? raw[i + 1] : 0;
  shifted[i] = ((curr << 3) | (next >> 5)) & 0xFF;
}
console.log("Shifted buffer hex:", shifted.toString('hex'));
console.log("Shifted buffer bytes:", Array.from(shifted));
