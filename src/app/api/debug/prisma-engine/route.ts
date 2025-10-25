import { NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

interface PathInfo {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  error?: string;
}

interface EngineInfo {
  name: string;
  exists: boolean;
  size?: number;
  path?: string;
  error?: string;
}

interface PrismaImport {
  success: boolean;
  clientAvailable?: boolean;
  error?: string;
}

export async function GET() {
  try {
    const debug = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      env: process.env.NODE_ENV,
      
      // Verificar caminhos do Prisma
      paths: {
        cwd: process.cwd(),
        nodeModules: join(process.cwd(), 'node_modules'),
        prismaClient: join(process.cwd(), 'node_modules', '.prisma', 'client'),
        prismaClientAlt: join(process.cwd(), 'node_modules', '@prisma', 'client'),
      },
      
      // Verificar se os diretórios existem
      pathsExist: {} as Record<string, PathInfo>,
      
      // Listar arquivos do Prisma
      prismaFiles: [] as string[],
      
      // Verificar engines
      engines: [] as EngineInfo[],
    }

    // Verificar se os caminhos existem
    for (const [key, path] of Object.entries(debug.paths)) {
      try {
        const stats = await stat(path)
        debug.pathsExist[key] = {
          exists: true,
          isDirectory: stats.isDirectory(),
          size: stats.size,
        }
      } catch (error) {
        debug.pathsExist[key] = {
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    // Listar arquivos do cliente Prisma se existir
    if (debug.pathsExist.prismaClient?.exists) {
      try {
        const files = await readdir(debug.paths.prismaClient)
        debug.prismaFiles = files.filter(f => 
          f.includes('libquery_engine') || 
          f.includes('schema.prisma') ||
          f.includes('index')
        )
      } catch (error) {
        debug.prismaFiles = [`Error reading directory: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }

    // Verificar engines específicos
    const engineFiles = [
      'libquery_engine-rhel-openssl-3.0.x.so.node',
      'libquery_engine-rhel-openssl-1.0.x.so.node',
      'libquery_engine-debian-openssl-3.0.x.so.node',
      'libquery_engine-linux-musl.so.node',
    ]

    for (const engine of engineFiles) {
      const enginePath = join(debug.paths.prismaClient, engine)
      try {
        const stats = await stat(enginePath)
        debug.engines.push({
          name: engine,
          exists: true,
          size: stats.size,
          path: enginePath,
        })
      } catch (error) {
        debug.engines.push({
          name: engine,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Tentar importar o Prisma Client
    let prismaImport: PrismaImport
    try {
      const { PrismaClient } = await import('@prisma/client')
      prismaImport = {
        success: true,
        clientAvailable: !!PrismaClient,
      }
    } catch (error) {
      prismaImport = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    return NextResponse.json({
      ...debug,
      prismaImport,
      recommendation: generateRecommendation(debug),
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to debug Prisma engine',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

function generateRecommendation(debug: {
  pathsExist: Record<string, PathInfo>;
  prismaFiles: string[];
  engines: EngineInfo[];
}) {
  const recommendations: string[] = []

  if (!debug.pathsExist.prismaClient?.exists) {
    recommendations.push('Prisma client directory not found - run "prisma generate"')
  }

  if (debug.prismaFiles.length === 0) {
    recommendations.push('No Prisma files found - client may not be generated')
  }

  const hasEngines = debug.engines.some((e: EngineInfo) => e.exists)
  if (!hasEngines) {
    recommendations.push('No query engines found - check binary targets in schema.prisma')
  }

  const hasRhelEngine = debug.engines.find((e: EngineInfo) => e.name.includes('rhel-openssl-3.0.x'))?.exists
  if (!hasRhelEngine) {
    recommendations.push('Missing rhel-openssl-3.0.x engine - required for Vercel')
  }

  if (recommendations.length === 0) {
    recommendations.push('All engines appear to be present - check runtime configuration')
  }

  return recommendations
}