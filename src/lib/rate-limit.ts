import { prisma } from "./prisma"

export async function rateLimit(
  identifier: string,
  action: string,
  maxAttempts: number,
  windowInSeconds: number
) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowInSeconds * 1000)

  // Buscar tentativas recentes
  const attempts = await prisma.securityLog.count({
    where: {
      eventType: action,
      userId: identifier,
      createdAt: {
        gte: windowStart
      }
    }
  })

  if (attempts >= maxAttempts) {
    const oldestAttempt = await prisma.securityLog.findFirst({
      where: {
        eventType: action,
        userId: identifier,
        createdAt: {
          gte: windowStart
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    if (oldestAttempt) {
      const resetTime = new Date(oldestAttempt.createdAt.getTime() + windowInSeconds * 1000)
      const secondsUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / 1000)
      
      throw new Error(
        `Muitas tentativas. Tente novamente em ${secondsUntilReset} segundos.`
      )
    }
  }

  return {
    success: true,
    limit: maxAttempts,
    remaining: maxAttempts - attempts,
    reset: new Date(now.getTime() + windowInSeconds * 1000)
  }
} 