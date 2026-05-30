const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'conflicts_response.json');

try {
  if (!fs.existsSync(filePath)) {
    console.log("File does not exist yet.");
    process.exit(0);
  }
  const data = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(data);
  console.log(`Number of conflicts: ${json.length}`);
  
  if (json.length > 0) {
    const item = json[0];
    console.log("Keys of first item:", Object.keys(item));
    console.log(`Length of photo_a: ${item.photo_a ? item.photo_a.length : 0}`);
    console.log(`Length of photo_b: ${item.photo_b ? item.photo_b.length : 0}`);
    
    let totalPhotoSize = 0;
    json.forEach(item => {
      if (item.photo_a) totalPhotoSize += item.photo_a.length;
      if (item.photo_b) totalPhotoSize += item.photo_b.length;
    });
    console.log(`Total size of all photos combined: ${(totalPhotoSize / (1024*1024)).toFixed(2)} MB`);
  }
} catch (err) {
  console.error("Error:", err.message);
}
