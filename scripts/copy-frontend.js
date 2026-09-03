const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'dist');
const dest = path.join(__dirname, '..', 'backend', 'public');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('frontend/dist not found. Build the frontend first.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied frontend/dist to backend/public');
