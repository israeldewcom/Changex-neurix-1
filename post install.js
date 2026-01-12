// postinstall.js
const fs = require('fs');
const path = require('path');

console.log('🔧 Running post-install fixes for Changex Neurix...');

// Fix 1: Ensure ajv is properly installed
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add resolution if not present
if (!packageJson.resolutions) {
  packageJson.resolutions = {};
}

packageJson.resolutions = {
  ...packageJson.resolutions,
  "ajv": "^8.12.0",
  "ajv-keywords": "^5.1.0",
  "webpack": "^5.88.2",
  "workbox-webpack-plugin": "^6.6.0"
};

// Update package.json
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json with resolutions');

// Fix 2: Create missing directory structure if needed
const ajvPath = path.join('node_modules', 'ajv', 'dist', 'compile');
if (!fs.existsSync(ajvPath)) {
  fs.mkdirSync(ajvPath, { recursive: true });
  console.log('✅ Created missing ajv directories');
}

console.log('🎉 Post-install fixes completed!');
