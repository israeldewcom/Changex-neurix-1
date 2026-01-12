#!/bin/bash
echo "🔧 Fixing Changex Neurix Build Issues..."

# Fix 1: Clean up
echo "🧹 Cleaning node_modules and cache..."
rm -rf node_modules package-lock.json .npmrc

# Fix 2: Create proper .npmrc
echo "📝 Creating .npmrc..."
cat > .npmrc << 'EOF'
engine-strict=false
legacy-peer-deps=true
strict-peer-dependencies=false
EOF

# Fix 3: Create proper vercel.json
echo "🚀 Creating vercel.json..."
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm install --legacy-peer-deps && CI=false npm run build",
  "outputDirectory": "build",
  "devCommand": "npm start",
  "installCommand": "npm install --legacy-peer-deps",
  "framework": "create-react-app",
  "nodeVersion": "20.x"
}
EOF

# Fix 4: Update package.json with ajv
echo "📦 Adding missing ajv dependencies..."
npm install --save ajv@8.12.0 ajv-keywords@5.1.0 webpack@5.88.2 --legacy-peer-deps

# Fix 5: Verify JSON
echo "✅ Checking package.json JSON validity..."
node -e "JSON.parse(require('fs').readFileSync('./package.json', 'utf8'))" && echo "✅ package.json is valid JSON"

echo "🎉 Fixes applied! Now run:"
echo "1. git add ."
echo "2. git commit -m 'Fix build dependencies'"
echo "3. git push origin main"
echo "4. Deploy on Vercel"
