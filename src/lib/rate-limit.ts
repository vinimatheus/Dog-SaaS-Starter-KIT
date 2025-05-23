import { prisma } from "./prisma"
import { headers } from "next/headers"

export async function rateLimit(
  userId: string,
  action: string,
  windowSeconds: number,
) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") || "unknown"
  
  // Verifica bloqueio de IP
  const ipBlock = await prisma.loginAttemptByIP.findUnique({
    where: { ip }
  })

  if (ipBlock?.blockedUntil && ipBlock.blockedUntil > new Date()) {
    throw new Error(`Muitas tentativas. Tente novamente em ${Math.ceil((ipBlock.blockedUntil.getTime() - Date.now()) / 1000 / 60)} minutos.`)
  }

  // Atualiza ou cria tentativa de IP
  await prisma.loginAttemptByIP.upsert({
    where: { ip },
    create: {
      id: Math.random().toString(36).substring(7),
      ip,
      attempts: 1,
      lastAttempt: new Date()
    },
    update: {
      attempts: {
        increment: 1
      },
      lastAttempt: new Date(),
      blockedUntil: {
        set: new Date(Date.now() + windowSeconds * 1000) // Bloqueio baseado no windowSeconds
      }
    }
  })

  // Verifica se excedeu o limite de tentativas
  if (ipBlock && ipBlock.attempts >= 5) { // Limite fixo de 5 tentativas
    throw new Error(`Muitas tentativas. Tente novamente em ${Math.ceil((ipBlock.blockedUntil?.getTime() || 0 - Date.now()) / 1000 / 60)} minutos.`)
  }

  return true
} 