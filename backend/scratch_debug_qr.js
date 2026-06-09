const { Jimp } = require('jimp');
const jsQR = require('jsqr');

async function tryDecode(image, desc) {
  const data = new Uint8ClampedArray(image.bitmap.data);
  const qrCode = jsQR(data, image.bitmap.width, image.bitmap.height);
  if (qrCode) {
    console.log(`[SUCCESS] Decoded with: ${desc}`);
    console.log('Data:', qrCode.data);
    return qrCode.data;
  }
  return null;
}

async function run() {
  const filePath = 'uploads/1777693278255-34358758.png';
  console.log(`Processing ${filePath}...`);
  try {
    const original = await Jimp.read(filePath);
    
    // Test 1: Original
    if (await tryDecode(original, 'Original')) return;

    // Test 2: Grayscale
    const img2 = original.clone().greyscale();
    if (await tryDecode(img2, 'Grayscale')) return;

    // Test 3: Grayscale + Contrast
    try {
      const img3 = img2.clone().contrast(0.5);
      if (await tryDecode(img3, 'Grayscale + Contrast 0.5')) return;
    } catch(e) {}

    // Test 4: Grayscale + Contrast + Binarize (threshold)
    try {
      const img4 = img2.clone();
      // Simple binarize: if value > 128 then white else black
      // scan pixels
      img4.scan((x, y, idx) => {
        const r = img4.bitmap.data[idx];
        const val = r > 128 ? 255 : 0;
        img4.bitmap.data[idx] = val;
        img4.bitmap.data[idx+1] = val;
        img4.bitmap.data[idx+2] = val;
      });
      if (await tryDecode(img4, 'Grayscale + Binarize')) return;
    } catch(e) {}

    // Test 5: Resize smaller (e.g. 500 width)
    try {
      const img5 = original.clone().resize({ width: 500 });
      if (await tryDecode(img5, 'Resize to 500px')) return;
      
      const img6 = img5.clone().greyscale();
      if (await tryDecode(img6, 'Resize to 500px + Grayscale')) return;
    } catch(e) {}

    // Test 6: Resize larger (e.g. 1000 width)
    try {
      const img7 = original.clone().resize({ width: 1000 });
      if (await tryDecode(img7, 'Resize to 1000px')) return;

      const img8 = img7.clone().greyscale();
      if (await tryDecode(img8, 'Resize to 1000px + Grayscale')) return;
    } catch(e) {}

    console.log('Failed to decode QR code with all methods.');
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
