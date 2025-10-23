"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { Role, InviteStatus, PlanType } from "@prisma/client"
import { z } from "zod"
import { unstable_cache } from "next/cache"
import { CreateInviteSchema } from "@/schemas/security"
import { auditLogger } from "@/lib/audit-logger"
import { permissionManager } from "@/lib/permission-manager"
import { checkAndUpdateExpiredInvite } from "@/lib/invite-cleanup"
import { recordOperationDuration, incrementSecurityCounter } from "@/lib/security"

const resend = new Resend(process.env.RESEND_API_KEY)

interface ManageInviteResult {
  success: boolean
  error?: string
  status?: InviteStatus
}

function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : ''
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
}

async function sendInviteEmail(invite: { id: string; email: string }, organization: { name: string }) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: invite.email,
      subject: `Convite para ${organization.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #2563eb; font-size: 24px; margin: 0 0 16px 0;">Você foi convidado para participar!</h1>
                <p style="font-size: 16px; color: #4b5563; margin: 0;">Você recebeu um convite para se juntar à organização</p>
                <p style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 8px 0 0 0;">${organization.name}</p>
              </div>
              <div style="background-color: #f3f4f6; border-radius: 6px; padding: 24px; margin-bottom: 32px; text-align: center;">
                <p style="margin: 0 0 24px 0; color: #4b5563;">Para aceitar o convite e começar a colaborar, clique no botão abaixo:</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${invite.id}" 
                   style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Aceitar Convite
                </a>
              </div>
              <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Este convite expira em 7 dias.</p>
                <p style="color: #6b7280; font-size: 14px; margin: 0;">Se você não solicitou este convite, pode ignorar este email com segurança.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    })
    return true
  } catch (error) {
    logError("SendInviteEmail", error)
    return false
  }
}

// Legacy checkInvitePermissions function - replaced by PermissionManager
const checkInvitePermissions = async (userId: string, organizationId: string) => {
  await permissionManager.validatePermission(userId, organizationId, "canSendInvites", {
    logFailure: true,
    context: "checkInvitePermissions"
  })

  // Return organization data for backward compatibility
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      User_Organization: {
        where: { user_id: userId }
      }
    }
  })

  if (!organization || organization.User_Organization.length === 0) {
    throw new Error("Você não tem permissão para gerenciar convites")
  }

  return {
    organization,
    role: organization.User_Organization[0].role
  }
}

export async function resendInviteAction(inviteId: string): Promise<ManageInviteResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Você precisa estar logado para reenviar convites" }
    }

    if (!inviteId || typeof inviteId !== 'string' || inviteId.trim() === '') {
      return { success: false, error: "ID do convite inválido" }
    }

    return await prisma.$transaction(async (tx) => {
      // Check and update expiration status before processing
      const isValidInvite = await checkAndUpdateExpiredInvite(inviteId)
      if (!isValidInvite) {
        return {
          success: false,
          error: "Este convite expirou e não pode ser reenviado",
          status: "EXPIRED",
        }
      }

      // Lock the invite to prevent concurrent modifications
      const invite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { organization: true },
      })

      if (!invite) {
        return { success: false, error: "Convite não encontrado" }
      }

      await checkInvitePermissions(session.user.id, invite.organization_id)

      if (invite.status !== "PENDING") {
        return {
          success: false,
          error: `Este convite não pode ser reenviado pois está ${invite.status === "ACCEPTED" ? "aceito" : invite.status === "REJECTED" ? "rejeitado" : "expirado"}`,
          status: invite.status,
        }
      }

      const emailSent = await sendInviteEmail(invite, invite.organization)
      if (!emailSent) {
        return { success: false, error: "Erro ao reenviar o email do convite" }
      }

      await tx.invite.update({
        where: { id: inviteId },
        data: {
          expires_at: addDays(new Date(), 7),
          updated_at: new Date(),
        },
      })

      await auditLogger.logInviteAction("invite_resent", session.user.id, inviteId, invite.organization_id, invite.email)

      revalidatePath(`/${invite.organization.uniqueId}`)
      return { success: true, status: "PENDING" }
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    })
  } catch (error) {
    logError("ResendInvite", error, auth().then(s => s?.user?.id).catch(() => undefined))
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao reenviar convite",
    }
  }
}

export async function deleteInviteAction(inviteId: string): Promise<ManageInviteResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Você precisa estar logado para excluir convites" }
    }

    if (!inviteId || typeof inviteId !== 'string' || inviteId.trim() === '') {
      return { success: false, error: "ID do convite inválido" }
    }

    return await prisma.$transaction(async (tx) => {
      // Check and update expiration status before processing
      await checkAndUpdateExpiredInvite(inviteId)

      // Lock the invite to prevent concurrent modifications
      const invite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { organization: true },
      })

      if (!invite) {
        return { success: false, error: "Convite não encontrado" }
      }

      await checkInvitePermissions(session.user.id, invite.organization_id)

      if (invite.status === "ACCEPTED") {
        return {
          success: false,
          error: "Não é possível excluir um convite que já foi aceito",
          status: invite.status,
        }
      }

      await tx.invite.delete({
        where: { id: inviteId },
      })

      await auditLogger.logInviteAction("invite_deleted", session.user.id, inviteId, invite.organization_id, invite.email, {
        inviteStatus: invite.status
      })

      revalidatePath(`/${invite.organization.uniqueId}`)
      return { success: true }
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    })
  } catch (error) {
    logError("DeleteInvite", error, auth().then(s => s?.user?.id).catch(() => undefined))
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao excluir convite",
    }
  }
}

export async function inviteMemberAction(formData: FormData): Promise<ManageInviteResult> {
  const startTime = Date.now()
  try {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
        action: "inviteMemberAction"
      })
      await incrementSecurityCounter("access_denied_count", {
        reason: "not_authenticated",
        action: "inviteMemberAction"
      })
      return { success: false, error: "Não autorizado" }
    }

    const email = formData.get("email") as string
    const role = formData.get("role") as Role
    const organizationId = formData.get("organizationId") as string

    // Validate and sanitize input using security schemas
    const result = CreateInviteSchema.safeParse({
      email,
      role,
      organizationId,
    })

    if (!result.success) {
      await auditLogger.logValidationFailure(userId, "inviteMemberAction", result.error.errors)
      await incrementSecurityCounter("security_violations_count", {
        reason: "validation_failed",
        userId,
        action: "inviteMemberAction"
      })
      return { 
        success: false, 
        error: result.error.errors[0].message 
      }
    }

    const { email: parsedEmail, role: parsedRole, organizationId: parsedOrgId } = result.data

    // Use atomic transaction to prevent race conditions
    return await prisma.$transaction(async (tx) => {
      // Check organization exists and user has permission
      const organization = await tx.organization.findUnique({
        where: { id: parsedOrgId }
      })

      if (!organization) {
        await auditLogger.logSecurityViolation(userId, "Organization not found", {
          organizationId: parsedOrgId,
          action: "inviteMemberAction"
        })
        throw new Error("Organização não encontrada")
      }

      // Use PermissionManager to check invite permissions
      const canSendInvites = await permissionManager.canSendInvites(userId, parsedOrgId, {
        logFailure: true,
        context: "inviteMemberAction"
      })

      if (!canSendInvites) {
        throw new Error("Você não tem permissão para convidar membros")
      }

      if (organization.plan === PlanType.FREE) {
        throw new Error("Organização está no plano gratuito")
      }

      // Check if user already exists and is a member (with lock)
      const existingUser = await tx.user.findUnique({
        where: { email: parsedEmail },
      })

      if (existingUser) {
        const existingMembership = await tx.user_Organization.findUnique({
          where: {
            user_id_organization_id: {
              user_id: existingUser.id,
              organization_id: parsedOrgId,
            },
          },
        })

        if (existingMembership) {
          throw new Error("Usuário já é membro desta organização")
        }
      }

      // Check for existing invite with atomic upsert to prevent race conditions
      const existingInvite = await tx.invite.findUnique({
        where: {
          email_organization_id: {
            email: parsedEmail,
            organization_id: parsedOrgId,
          },
        },
      })

      if (existingInvite) {
        if (existingInvite.status === "PENDING" && existingInvite.expires_at > new Date()) {
          throw new Error("Já existe um convite pendente para este email")
        }
        
        // Update existing expired or rejected invite
        const expiresAt = addDays(new Date(), 7)
        
        await tx.invite.update({
          where: { id: existingInvite.id },
          data: {
            role: parsedRole,
            invited_by_id: userId,
            expires_at: expiresAt,
            status: "PENDING",
            updated_at: new Date(),
          },
        })
      } else {
        // Create new invite
        const expiresAt = addDays(new Date(), 7)
        
        await tx.invite.create({
          data: {
            email: parsedEmail,
            role: parsedRole,
            organization_id: parsedOrgId,
            invited_by_id: userId,
            expires_at: expiresAt,
          },
        })
      }

      await auditLogger.logInviteAction("invite_sent", userId, existingInvite?.id || "new", parsedOrgId, parsedEmail, {
        inviteRole: parsedRole
      })

      // Record successful invite operation metrics
      await recordOperationDuration("inviteMemberAction", startTime, {
        userId,
        organizationId: parsedOrgId,
        inviteEmail: parsedEmail,
        inviteRole: parsedRole,
        success: true
      })

      await incrementSecurityCounter("invite_operations_count", {
        userId,
        organizationId: parsedOrgId,
        action: "invite_sent",
        inviteRole: parsedRole
      })

      revalidatePath(`/${organization.uniqueId}/config/members`)
      return { success: true }
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
      timeout: 10000 // 10 second timeout
    })
  } catch (error) {
    const userId = await auth().then(s => s?.user?.id).catch(() => undefined)
    logError("InviteMember", error, userId)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao convidar membro" 
    }
  }
}

export async function getPendingInvitesForUserAction() {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false, error: "Usuário não autenticado", invites: [] }
    }

    const now = new Date()
    const pendingInvites = await prisma.invite.findMany({
      where: {
        email: session.user.email.toLowerCase(),
        status: "PENDING",
        expires_at: { gt: now }
      },
      include: {
        organization: true,
        invited_by: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return { 
      success: true, 
      invites: pendingInvites
    }
  } catch (error) {
    logError("GetPendingInvites", error, auth().then(s => s?.user?.id).catch(() => undefined))
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao buscar convites pendentes",
      invites: []
    }
  }
}
