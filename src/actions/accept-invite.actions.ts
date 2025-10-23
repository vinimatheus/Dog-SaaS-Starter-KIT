"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Role, Prisma } from "@prisma/client"
import { z } from "zod"
import { unstable_cache } from "next/cache"
import { NotificationService } from "@/lib/services/notification.service"
import { CuidSchema } from "@/schemas/security"
import { auditLogger } from "@/lib/audit-logger"
import { checkAndUpdateExpiredInvite } from "@/lib/invite-cleanup"

const InviteTokenSchema = z.object({
  inviteId: CuidSchema,
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



export async function acceptInviteAction(inviteIdRaw: string): Promise<AcceptInviteResult> {
  try {
    const result = InviteTokenSchema.safeParse({ inviteId: inviteIdRaw })
    if (!result.success) {
      await auditLogger.logValidationFailure(undefined, "acceptInviteAction", result.error.errors, {
        inviteId: inviteIdRaw
      })
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
      await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
        action: "acceptInviteAction",
        inviteId
      })
      return { success: false, error: "Você precisa estar logado para aceitar convites" }
    }

    // Check and update expiration status before processing
    const isValidInvite = await checkAndUpdateExpiredInvite(inviteId)
    if (!isValidInvite) {
      return { success: false, error: "Este convite expirou" }
    }

    // Use serializable transaction to prevent race conditions
    return await prisma.$transaction(async (tx) => {
      // Lock the invite row to prevent concurrent modifications
      const freshInvite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { organization: true, invited_by: true },
      })

      const validationError = validateInvite(freshInvite, userEmail)
      if (validationError) {
        return { success: false, error: validationError }
      }

      if (!freshInvite) {
        return { success: false, error: "Convite não encontrado" }
      }

      // Check if user is already a member (race condition protection)
      const existingMembership = await tx.user_Organization.findFirst({
        where: { 
          user_id: userId, 
          organization_id: freshInvite.organization.id 
        },
      })

      if (existingMembership) {
        // Update invite status to accepted since user is already a member
        await tx.invite.update({
          where: { id: inviteId },
          data: { status: "ACCEPTED" },
        })
        return { 
          success: true,
          redirectUrl: `/${freshInvite.organization.uniqueId}`
        }
      }

      // Create membership atomically
      await tx.user_Organization.create({
        data: { 
          user_id: userId, 
          organization_id: freshInvite.organization.id, 
          role: freshInvite.role as Role 
        },
      })

      // Update invite status
      await tx.invite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED" },
      })

      await auditLogger.logInviteAction("invite_accepted", userId, inviteId, freshInvite.organization.id, freshInvite.email, {
        inviteRole: freshInvite.role as Role
      })
      
      // Create notification (outside transaction to avoid blocking)
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
        }
      }

      revalidatePath("/")
      revalidatePath(`/${freshInvite.organization.uniqueId}`)
      revalidatePath("/organizations")

      return {
        success: true,
        redirectUrl: `/${freshInvite.organization.uniqueId}`
      }
    }, {
      isolationLevel: 'Serializable', // Prevent race conditions
      timeout: 10000 // 10 second timeout
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

    // Check and update expiration status before processing
    await checkAndUpdateExpiredInvite(inviteId)

    return await prisma.$transaction(async (tx) => {
      const freshInvite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { organization: true, invited_by: true },
      })

      const validationError = validateInvite(freshInvite, userEmail)
      if (validationError) {
        return { success: false, error: validationError }
      }

      if (!freshInvite) {
        return { success: false, error: "Convite não encontrado" }
      }

      await tx.invite.update({
        where: { id: inviteId },
        data: { status: "REJECTED" },
      })

      await auditLogger.logInviteAction("invite_rejected", userId, inviteId, freshInvite.organization.id, freshInvite.email, {
        inviteRole: freshInvite.role as Role
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
