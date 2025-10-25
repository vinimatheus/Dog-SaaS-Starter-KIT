import { PrismaClient } from "@prisma/client"

declare global {
  var __prisma: PrismaClient | undefined
}

// Configuração específica para Vercel com fallbacks
function createPrismaClient() {
  const config: any = {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }

  // Configurações específicas para Vercel
  if (process.env.VERCEL) {
    config.__internal = {
      engine: {
        binaryPath: undefined, // Let Prisma auto-detect
      },
    }
  }

  return new PrismaClient(config)
}

// Singleton pattern
export const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma
}

// Graceful shutdown
if (process.env.NODE_ENV === "production") {
  process.on('beforeExit', async () => {
    try {
      await prisma.$disconnect()
    } catch (error) {
      console.error('Error disconnecting Prisma:', error)
    }
  })
}