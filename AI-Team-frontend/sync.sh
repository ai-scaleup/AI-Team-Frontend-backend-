#!/bin/bash

echo "🚀 Starting Infrastructure Sync..."

# 1. Pull latest changes
echo "📥 Pulling latest changes from main..."
git checkout main
git pull origin main

# 2. Update dependencies
echo "📦 Updating dependencies..."
npm install

# 3. Environment Variable Audit
echo "🔍 Checking environment variables..."
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found! Creating from template..."
    cp .env.example .env.local 2>/dev/null || echo "❌ No .env.example found. Please create .env.local manually."
else
    echo "✅ .env.local exists."
fi

# 4. Optional: Verify build
echo "🏗️  Running build check..."
npm run build --no-lint

echo "🎨 Sync completed successfully! Your local environment is now aligned with the multi-tier infrastructure."
