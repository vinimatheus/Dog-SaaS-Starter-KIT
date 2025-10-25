import { NextResponse } from 'next/server'
import { readdir, access } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  const debug = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    
    // Verificar variáveis de ambiente
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      PRISMA_CLI_BINARY_TARGETS: process.env.PRISMA_CLI_BINARY_TARGETS,
      PRISMA_GENERATE_SKIP_AUTOINSTALL: process.env.PRISMA_GENERATE_SKIP_AUTOINSTALL,
    },
    
    // Tentar encontrar arquivos do Prisma
    prismaFiles: {
      clientExists: false,
      engineFiles: [],
      searchPaths: [],
      errors: []
    }
  }

  // Caminhos para procurar o cliente Prisma
  const searchPaths = [
    '/var/task/node_modules/.prisma/client',
    '/var/task/node_modules/@prisma/client',
    '/vercel/path0/node_modules/.prisma/client',
    '/vercel/path0/node_modules/@prisma/client',
    '/tmp/prisma-engines',
    './node_modules/.prisma/client',
    './node_modules/@prisma/client'
  ]

  debug.prismaFiles.searchPaths = searchPaths

  for (const path of searchPaths) {
    try {
      await access(path)
      debug.prismaFiles.clientExists = true
      
      try {
        const files = await readdir(path)
        const engineFiles = files.filter(f => 
          f.includes('libquery_engine') || 
          f.includes('query_engine') ||
          f.includes('.node') ||
          f.includes('.so')
        )
        
        if (engineFiles.length > 0) {
          debug.prismaFiles.engineFiles.push({
            path,
            files: engineFiles
          })
        }
      } catch (readError) {
        debug.prismaFiles.errors.push({
          path,
          error: 'Could not read directory',
          details: readError instanceof Error ? readError.message : String(readError)
        })
      }
    } catch (accessError) {
      debug.prismaFiles.errors.push({
        path,
        error: 'Path not accessible',
        details: accessError instanceof Error ? accessError.message : String(accessError)
      })
    }
  }

  // Tentar importar e testar o Prisma
  let prismaTest = {
    importSuccess: false,
    clientCreated: false,
    connectionTest: false,
    error: null as string | null
  }

  try {
    const { PrismaClient } = await import('@prisma/client')
    prismaTest.importSuccess = true
    
    try {
      const client = new PrismaClient()
      prismaTest.clientCreated = true
      
      try {
        // Teste simples de conexão
        await client.$queryRaw`SELECT 1 as test`
        prismaTest.connectionTest = true
        await client.$disconnect()
      } catch (queryError) {
        prismaTest.error = queryError instanceof Error ? queryError.message : String(queryError)
      }
    } catch (clientError) {
      prismaTest.error = clientError instanceof Error ? clientError.message : String(clientError)
    }
  } catch (importError) {
    prismaTest.error = importError instanceof Error ? importError.message : String(importError)
  }

  return NextResponse.json({
    ...debug,
    prismaTest,
    recommendation: getPrismaRecommendation(debug, prismaTest)
  })
}

function getPrismaRecommendation(debug: any, prismaTest: any) {
  if (!prismaTest.importSuccess) {
    return "Prisma Client não pode ser importado. Verifique se @prisma/client está instalado."
  }
  
  if (!prismaTest.clientCreated) {
    return "Prisma Client não pode ser criado. Problema com Query Engine."
  }
  
  if (!prismaTest.connectionTest) {
    return `Prisma Client criado mas não consegue conectar: ${prismaTest.error}`
  }
  
  if (debug.prismaFiles.engineFiles.length === 0) {
    return "Nenhum arquivo de engine encontrado. Execute 'prisma generate' com binary targets corretos."
  }
  
  return "Prisma funcionando corretamente!"
}