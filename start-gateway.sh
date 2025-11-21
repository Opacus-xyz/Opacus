#!/bin/bash
# Start Opacus Gateway

echo "🚀 Starting Opacus Gateway..."
cd gateway

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build if needed
if [ ! -d "dist" ]; then
    echo "🔨 Building gateway..."
    npm run build
fi

echo "✅ Starting server on http://localhost:8080"
npm start
