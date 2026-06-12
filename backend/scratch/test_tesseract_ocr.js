const { createWorker } = require('tesseract.js');
const path = require('path');

async function run() {
  console.log("Initializing Tesseract worker...");
  const worker = await createWorker('spa'); // Spanish language
  
  const imagePath = path.join(__dirname, 'mesa1_acta.jpg');
  console.log("Running OCR on:", imagePath);
  const { data: { text } } = await worker.recognize(imagePath);
  
  console.log("\n=== EXTRACTED TEXT ===");
  console.log(text);
  console.log("======================");
  
  await worker.terminate();
}
run().catch(err => console.error("OCR Error:", err));
