const fs = require('fs');
const path = require('path');

const corruptedPath = path.join(__dirname, 'temp_db_95b.db');
const recoveredPath = path.join(__dirname, 'temp_db_95b_binary.db');

if (!fs.existsSync(corruptedPath)) {
  console.log("temp_db_95b.db not found");
  process.exit(0);
}

const stats = fs.statSync(corruptedPath);
console.log("Corrupted file size:", stats.size);

// Let's read the first 200 bytes and try to decode
const buf = fs.readFileSync(corruptedPath);

// Check BOM
console.log("BOM bytes:", buf.slice(0, 2).toString('hex'));

// Let's try converting UTF-16 to binary buffer
// If it was written as UTF-16LE string, we can read it as string with 'utf16le' encoding and write as binary buffer
try {
  const contentStr = buf.toString('utf16le');
  // Write the string as binary (utf-8 or raw)
  const binaryBuf = Buffer.from(contentStr, 'binary');
  console.log("Resulting binary header:", binaryBuf.slice(0, 50).toString('hex'));
  console.log("Resulting binary header text:", binaryBuf.slice(0, 16).toString('ascii'));
  
  if (binaryBuf.slice(0, 15).toString('ascii') === 'SQLite format 3') {
    console.log("SUCCESS! Decoded successfully as UTF-16LE string.");
    // Write full binary to test
    fs.writeFileSync(recoveredPath, binaryBuf);
    console.log("Wrote reconstructed DB to temp_db_95b_binary.db");
  } else {
    // Try other decoding: what if we just drop every second byte?
    const alternate = Buffer.alloc(Math.floor((buf.length - 2) / 2));
    for (let i = 2, j = 0; i < buf.length; i += 2, j++) {
      alternate[j] = buf[i];
    }
    console.log("Alternate (even bytes stripped) header:", alternate.slice(0, 50).toString('hex'));
    console.log("Alternate (even bytes stripped) text:", alternate.slice(0, 16).toString('ascii'));
    if (alternate.slice(0, 15).toString('ascii') === 'SQLite format 3') {
      console.log("SUCCESS! Reconstructed by stripping even bytes.");
      fs.writeFileSync(recoveredPath, alternate);
      console.log("Wrote reconstructed DB to temp_db_95b_binary.db");
    }
  }
} catch (e) {
  console.error("Error attempting recovery:", e.message);
}
