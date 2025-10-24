// Configuração específica do Prisma para Vercel
module.exports = {
  // Força a geração de todos os binários necessários
  binaryTargets: [
    'native',
    'rhel-openssl-1.0.x',
    'rhel-openssl-3.0.x',
    'debian-openssl-1.1.x',
    'debian-openssl-3.0.x',
    'linux-musl'
  ],
  
  // Configurações de engine
  engineType: 'binary',
  
  // Output path
  output: '../node_modules/.prisma/client',
  
  // Configurações de geração
  generator: {
    provider: 'prisma-client-js',
    previewFeatures: []
  }
}