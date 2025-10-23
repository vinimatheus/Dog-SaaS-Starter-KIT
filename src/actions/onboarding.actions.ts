"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PlanType } from "@prisma/client"
import { auditLogger } from "@/lib/audit-logger"
import { headers } from "next/headers"
import { createCheckoutSession } from "@/actions/stripe.actions"
import { revalidatePath } from "next/cache"

export async function updateProfile(data: { name: string }) {
  const session = await auth()

  if (!session?.user?.id) {
    await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
      action: "updateProfile"
    })
    throw new Error("Não autorizado")
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name }
  })

  await auditLogger.logEvent("profile_update", {
    userId: session.user.id,
    metadata: { 
      name: data.name,
      action: "updateProfile"
    }
  })

  revalidatePath("/onboarding")
}

export async function createOrganization(data: { name: string }) {
  const session = await auth()

  if (!session?.user?.id) {
    await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
      action: "createOrganization"
    })
    throw new Error("Não autorizado")
  }

  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      owner_user_id: session.user.id,
      uniqueId: `${data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}-${Math.random().toString(36).substring(2, 8)}`,
      plan: PlanType.FREE,
      User_Organization: {
        create: {
          user_id: session.user.id,
          role: "OWNER"
        }
      }
    }
  })

  await auditLogger.logOrganizationManagement("organization_creation", session.user.id, organization.id, organization.name, {
    organizationUniqueId: organization.uniqueId,
    plan: PlanType.FREE
  })

  revalidatePath("/onboarding")
  revalidatePath(`/${organization.uniqueId}`)

  return organization
}

export async function redirectToCheckout(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
      action: "redirectToCheckout",
      organizationId
    })
    throw new Error("Não autorizado")
  }

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
    await auditLogger.logEvent("checkout_redirect", {
      userId: session.user.id,
      metadata: { 
        organizationId,
        action: "redirectToCheckout"
      }
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

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { uniqueId: true }
  })

  if (!organization) {
    throw new Error("Organização não encontrada")
  }

  revalidatePath("/onboarding")
  revalidatePath(`/${organization.uniqueId}`)

  redirect(`/${organization.uniqueId}`)
} 