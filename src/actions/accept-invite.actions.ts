"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Role, Prisma } from "@prisma/client"
import { z } from "zod"
import { unstable_cache } from "next/cache"
import { NotificationService } from "@/lib/services/notification.service"

const InviteTokenSchema = z.object({
  inviteId: z.string().min(1, "ID de convite inválido"),
})

interface AcceptInviteResult {
  success: boolean
  error?: string
  redirectUrl?: string
}

const statusMessages: Record<string, string> = {
  ACCEPTED: "aceito",
  REJECTED: "rejeitado",
  EXPIRED: "expirado",
}

function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : '';
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
}

type InviteWithOrganization = NonNullable<Awaited<ReturnType<typeof getInvite>>>

const getInvite = unstable_cache(
  async (inviteId: string) => {
    return prisma.invite.findUnique({
      where: { id: inviteId },
      include: { organization: true },
    })
  },
  ["invite-details"],
  { revalidate: 10 } 
)

function validateInvite(invite: InviteWithOrganization | null, userEmail: string): string | null {
  if (!invite) return "Convite não encontrado"

  if (invite.status !== "PENDING") {
    return `Este convite já foi ${statusMessages[invite.status] ?? "processado"}`
  }

  if (invite.expires_at < new Date()) return "Este convite expirou"

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) return "Este convite foi enviado para outro email"

  return null
}

async function registerMembership(
  tx: Prisma.TransactionClient, 
  userId: string, 
  organizationId: string, 
  role: Role
): Promise<string | null> {
  try {
    const existing = await tx.user_Organization.findFirst({
      where: { user_id: userId, organization_id: organizationId },
    })

    if (existing) return "Você já faz parte desta organização"

    await tx.user_Organization.create({
      data: { user_id: userId, organization_id: organizationId, role },
    })

    return null
  } catch (error) {
    logError("RegisterMembership", error, userId)
    throw new Error("Erro ao registrar associação")
  }
}

export async function acceptInviteAction(inviteIdRaw: string): Promise<AcceptInviteResult> {
  try {
    const result = InviteTokenSchema.safeParse({ inviteId: inviteIdRaw })
    if (!result.success) {
      return { 
        success: false, 
        error: result.error.errors[0].message 
      }
    }
    
    const { inviteId } = result.data
    
    const session = await auth()
    const userId = session?.user?.id
    const userEmail = session?.user?.email

    if (!userId || !userEmail) {
      return { success: false, error: "Você precisa estar logado para aceitar convites" }
    }

    const invite = await getInvite(inviteId)
    
    if (!invite) {
      return { success: false, error: "Convite não encontrado" }
    }

    return await prisma.$transaction(async (tx) => {
      const freshInvite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { organization: true, invited_by: true },
      })

      const validationError = validateInvite(freshInvite, userEmail)
      if (validationError) {
        if (validationError === "Este convite expirou" && freshInvite) {
          await tx.invite.update({
            where: { id: inviteId },
            data: { status: "EXPIRED" }
          })
        }
        return { success: false, error: validationError }
      }

      if (!freshInvite) {
        return { success: false, error: "Convite não encontrado" }
      }

      const membershipError = await registerMembership(tx, userId, freshInvite.organization.id, freshInvite.role as Role)
      if (membershipError) {
        return { success: false, error: membershipError }
      }

      await tx.invite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED" },
      })
      
      if (freshInvite.invited_by) {
        try {
          await NotificationService.createNotification({
            userId: freshInvite.invited_by.id,
            title: "Convite aceito",
            message: `${session.user.name || session.user.email} aceitou seu convite para a organização ${freshInvite.organization.name}`,
            type: "INVITE",
            linkedEntity: freshInvite.organization.id,
            entityType: "organization"
          });
        } catch (notificationError) {
          console.error("Erro ao criar notificação de convite aceito:", notificationError);
          // Não interrompe o fluxo
        }
      }

      revalidatePath("/")
      revalidatePath(`/${freshInvite.organization.uniqueId}`)
      revalidatePath("/organizations")

      return {
        success: true,
        redirectUrl: `/${freshInvite.organization.uniqueId}`
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }
    
    const userId = await auth().then(s => s?.user?.id).catch(() => undefined);
    logError("AcceptInvite", error, userId)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao aceitar convite" 
    }
  }
}

export async function rejectInviteAction(inviteIdRaw: string): Promise<AcceptInviteResult> {
  try {
    const result = InviteTokenSchema.safeParse({ inviteId: inviteIdRaw })
    if (!result.success) {
      return { 
        success: false, 
        error: result.error.errors[0].message 
      }
    }
    
    const { inviteId } = result.data
    
    const session = await auth()
    const userId = session?.user?.id
    const userEmail = session?.user?.email

    if (!userId || !userEmail) {
      return { success: false, error: "Você precisa estar logado para gerenciar convites" }
    }

    const invite = await getInvite(inviteId)
    
    if (!invite) {
      return { success: false, error: "Convite não encontrado" }
    }

    return await prisma.$transaction(async (tx) => {
      const freshInvite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { organization: true, invited_by: true },
      })

      const validationError = validateInvite(freshInvite, userEmail)
      if (validationError) {
        if (validationError === "Este convite expirou" && freshInvite) {
          await tx.invite.update({
            where: { id: inviteId },
            data: { status: "EXPIRED" }
          })
        }
        return { success: false, error: validationError }
      }

      if (!freshInvite) {
        return { success: false, error: "Convite não encontrado" }
      }

      await tx.invite.update({
        where: { id: inviteId },
        data: { status: "REJECTED" },
      })
      
      if (freshInvite.invited_by) {
        try {
          await NotificationService.createNotification({
            userId: freshInvite.invited_by.id,
            title: "Convite rejeitado",
            message: `${session.user.name || session.user.email} rejeitou seu convite para a organização ${freshInvite.organization.name}`,
            type: "INVITE",
            linkedEntity: freshInvite.organization.id,
            entityType: "organization"
          });
        } catch (notificationError) {
          console.error("Erro ao criar notificação de convite rejeitado:", notificationError);
          // Não interrompe o fluxo
        }
      }

      revalidatePath("/")
      revalidatePath(`/organizations`)

      return {
        success: true,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }
    
    const userId = await auth().then(s => s?.user?.id).catch(() => undefined);
    logError("RejectInvite", error, userId)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao rejeitar convite" 
    }
  }
}
