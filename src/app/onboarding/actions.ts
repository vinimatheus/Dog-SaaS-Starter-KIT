"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PlanType } from "@prisma/client"
import { rateLimit } from "@/lib/rate-limit"
import { logSecurityEvent } from "@/lib/security-logger"
import { headers } from "next/headers"
import { createCheckoutSession } from "@/actions/stripe.actions"

export async function updateProfile(data: { name: string }) {
  const session = await auth()

  if (!session?.user?.id) {
    const headersList = await headers()
    await logSecurityEvent("unauthorized_profile_update", {
      userId: session?.user?.id,
      ip: headersList.get("x-forwarded-for")
    })
    throw new Error("Não autorizado")
  }

  // Rate limit: 10 tentativas por hora
  await rateLimit(session.user.id, "profile_update", 3600)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name }
  })

  await logSecurityEvent("profile_update", {
    userId: session.user.id,
    metadata: { name: data.name }
  })
}

export async function createOrganization(data: { name: string, plan: PlanType }) {
  const session = await auth()

  if (!session?.user?.id) {
    const headersList = await headers()
    await logSecurityEvent("unauthorized_organization_creation", {
      userId: session?.user?.id,
      ip: headersList.get("x-forwarded-for")
    })
    throw new Error("Não autorizado")
  }

  // Rate limit: 5 tentativas por hora
  await rateLimit(session.user.id, "organization_creation", 3600)

  // Validação adicional do plano
  if (data.plan === PlanType.PRO) {
    // Verificar se o usuário já tem uma organização PRO
    const existingProOrg = await prisma.organization.findFirst({
      where: {
        User_Organization: {
          some: {
            user_id: session.user.id,
            role: "OWNER"
          }
        },
        plan: PlanType.PRO
      }
    })

    if (existingProOrg) {
      throw new Error("Você já possui uma organização com plano PRO")
    }
  }

  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      owner_user_id: session.user.id,
      uniqueId: `${data.name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).substring(2, 8)}`,
      plan: data.plan,
      User_Organization: {
        create: {
          user_id: session.user.id,
          role: "OWNER"
        }
      }
    }
  })

  await logSecurityEvent("organization_creation", {
    userId: session.user.id,
    metadata: { 
      organizationId: organization.id,
      plan: data.plan
    }
  })

  return organization
}

export async function redirectToCheckout(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    const headersList = await headers()
    await logSecurityEvent("unauthorized_checkout_redirect", {
      userId: session?.user?.id,
      ip: headersList.get("x-forwarded-for")
    })
    throw new Error("Não autorizado")
  }

  // Rate limit: 5 tentativas por hora
  await rateLimit(session.user.id, "checkout_redirect", 3600)

  // Verificar se a organização pertence ao usuário
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      User_Organization: {
        some: {
          user_id: session.user.id,
          role: "OWNER"
        }
      }
    }
  })

  if (!organization) {
    throw new Error("Organização não encontrada")
  }

  const { url } = await createCheckoutSession(organizationId)
  
  if (url) {
    await logSecurityEvent("checkout_redirect", {
      userId: session.user.id,
      metadata: { organizationId }
    })
    redirect(url)
  }

  throw new Error("Erro ao criar sessão de checkout")
}

export async function completeOnboarding(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Não autorizado")
  }

  if (!organizationId) {
    throw new Error("ID da organização é obrigatório")
  }

  // Buscar a organização para obter o uniqueId
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { uniqueId: true }
  })

  if (!organization) {
    throw new Error("Organização não encontrada")
  }

  // O redirect do Next.js deve ser chamado diretamente, sem try/catch
  redirect(`/${organization.uniqueId}`)
} 