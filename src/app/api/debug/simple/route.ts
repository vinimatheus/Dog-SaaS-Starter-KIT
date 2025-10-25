import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    
    // Verificar variáveis de ambiente básicas
    envVars: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      EMAIL_FROM: !!process.env.EMAIL_FROM,
      NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    },
    
    message: 'Simple debug endpoint working - no Prisma dependencies'
  })
}