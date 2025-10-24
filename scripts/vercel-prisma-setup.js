const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Setting up Prisma for Vercel deployment...');

try {
  // Ensure we're in the right directory
  process.chdir(path.resolve(__dirname, '..'));
  
  console.log('📦 Installing dependencies...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  
  console.log('🔧 Generating Prisma client with all binary targets...');
  execSync('npx prisma generate --schema=./prisma/schema.prisma', { stdio: 'inherit' });
  
  // Verify the client was generated
  const clientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
  if (fs.existsSync(clientPath)) {
    console.log('✅ Prisma client generated successfully at:', clientPath);
    
    // List generated files for debugging
    const files = fs.readdirSync(clientPath);
    console.log('📁 Generated files:', files.filter(f => f.includes('libquery_engine')));
  } else {
    console.error('❌ Prisma client not found at expected location');
    process.exit(1);
  }
  
  console.log('🏗️ Building Next.js application...');
  execSync('TURBOPACK=false npx next build', { stdio: 'inherit' });
  
  console.log('✅ Vercel build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}