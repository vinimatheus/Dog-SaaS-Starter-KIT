#!/bin/bash
set -e

echo "🚀 Starting Vercel build process..."

# Install dependencies with legacy peer deps
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Generate Prisma client with correct binaries
echo "🔄 Generating Prisma client..."
npx prisma generate

# Build Next.js application
echo "🏗️ Building Next.js application..."
npx next build

echo "✅ Build completed successfully!"