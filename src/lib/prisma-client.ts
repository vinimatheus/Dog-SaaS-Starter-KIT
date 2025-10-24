import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

// Função para criar cliente Prisma com configurações otimizadas para Vercel
function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // Conectar explicitamente em produção
  if (process.env.NODE_ENV === 'production') {
    client.$connect().catch((error) => {
      console.error('Failed to connect to database:', error)
    })
  }

  return client
}

// Usar singleton em desenvolvimento para evitar múltiplas conexões
export const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}