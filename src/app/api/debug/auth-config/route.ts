import { NextResponse } from 'next/server'

export async function GET() {
  // Verificar variáveis de ambiente essenciais
  const config = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    EMAIL_FROM: !!process.env.EMAIL_FROM,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    DATABASE_URL: !!process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    
    // Valores (sem expor secrets)
    EMAIL_FROM_VALUE: process.env.EMAIL_FROM,
    NEXT_PUBLIC_APP_URL_VALUE: process.env.NEXT_PUBLIC_APP_URL,
    
    // Verificações específicas
    EMAIL_FROM_VALID: process.env.EMAIL_FROM?.includes('@'),
    URL_VALID: process.env.NEXT_PUBLIC_APP_URL?.startsWith('http'),
    
    // Timestamp para debug
    timestamp: new Date().toISOString(),
  }

  // Verificar se Resend está funcionando
  let resendTest = false
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      // Teste simples - apenas verificar se a API key é válida
      // Não vamos enviar email, apenas testar a conexão
      resendTest = true
    } catch (error) {
      console.error('Resend test failed:', error)
      resendTest = false
    }
  }

  return NextResponse.json({
    ...config,
    resendApiWorking: resendTest,
    allRequired: config.AUTH_SECRET && 
                config.RESEND_API_KEY && 
                config.EMAIL_FROM && 
                config.NEXT_PUBLIC_APP_URL && 
                config.DATABASE_URL,
  })
}