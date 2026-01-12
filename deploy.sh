#!/bin/bash
# Changex Neurix Deployment Script

echo "🚀 Starting Changex Neurix Deployment..."

# Build the project
echo "📦 Building project..."
npm run build

# Verify build
if [ ! -d "build" ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed successfully!"

# Copy public files to build
echo "📁 Copying public assets..."
cp -r public/* build/

# Set permissions
echo "🔒 Setting permissions..."
find build -type f -exec chmod 644 {} \;
find build -type d -exec chmod 755 {} \;

echo "🎉 Deployment package ready in build/ folder"
echo "📦 Total size: $(du -sh build | cut -f1)"

# Deploy instructions
echo ""
echo "📋 Deployment Options:"
echo "1. Vercel: vercel --prod"
echo "2. Netlify: netlify deploy --prod"
echo "3. AWS S3: aws s3 sync build/ s3://your-bucket --delete"
echo "4. Manual: Upload build/ folder to your hosting"
