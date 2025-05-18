"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { Role, InviteStatus } from "@prisma/client"
import { z } from "zod"
import { randomUUID } from "crypto"
import { unstable_cache } from "next/cache"

const resend = new Resend(process.env.RESEND_API_KEY)

const InviteSchema = z.object({
  email: z.string().email().toLowerCase(),
  organizationId: z.string().uuid(),
  role: z.enum(["OWNER", "ADMIN", "USER"]).default("USER"),
})

interface InviteResult {
  success: boolean
  error?: string
  inviteId?: string
}

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

const checkInvitePermissions = unstable_cache(
  async (userId: string, organizationId: string) => {
    const userOrg = await prisma.user_Organization.findFirst({
      where: {
        user_id: userId,
        organization_id: organizationId,
        role: {
          in: ["OWNER", "ADMIN"],
        },
      },
      include: {
        organization: true,
      },
    })

    if (!userOrg) {
      throw new Error("Você não tem permissão para gerenciar convites")
    }

    return userOrg
  },
  ["invite-permissions"],
  { revalidate: 60 }
)

export async function resendInviteAction(inviteId: string): Promise<ManageInviteResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Você precisa estar logado para reenviar convites" }
    }

    if (!inviteId || typeof inviteId !== 'string' || inviteId.trim() === '') {
      return { success: false, error: "ID do convite inválido" }
    }

    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: { organization: true },
    })

    if (!invite) {
      return { success: false, error: "Convite não encontrado" }
    }

    return await prisma.$transaction(async (tx) => {
      await checkInvitePermissions(session.user.id, invite.organization_id)

      if (invite.status !== "PENDING") {
        return {
          success: false,
          error: `Este convite não pode ser reenviado pois está ${invite.status === "ACCEPTED" ? "aceito" : invite.status === "REJECTED" ? "rejeitado" : "expirado"}`,
          status: invite.status,
        }
      }

      if (invite.expires_at < new Date()) {
        await tx.invite.update({
          where: { id: inviteId },
          data: { status: "EXPIRED" },
        })
        return {
          success: false,
          error: "Este convite expirou e não pode ser reenviado",
          status: "EXPIRED",
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

      revalidatePath(`/${invite.organization.uniqueId}`)
      return { success: true, status: "PENDING" }
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

    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: { organization: true },
    })

    if (!invite) {
      return { success: false, error: "Convite não encontrado" }
    }

    return await prisma.$transaction(async (tx) => {
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

      revalidatePath(`/${invite.organization.uniqueId}`)
      return { success: true }
    })
  } catch (error) {
    logError("DeleteInvite", error, auth().then(s => s?.user?.id).catch(() => undefined))
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao excluir convite",
    }
  }
}

export async function inviteMemberAction(formData: FormData): Promise<InviteResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return { success: false, error: "Você precisa estar logado para convidar membros" }
    }

    const rawData = {
      email: (formData.get("email") as string || "").trim().toLowerCase(),
      organizationId: formData.get("organizationId") as string,
      role: (formData.get("role") as Role) || "USER",
    }

    const result = InviteSchema.safeParse(rawData)
    if (!result.success) {
      return { success: false, error: result.error.errors[0].message }
    }

    const { email, organizationId, role } = result.data

    if (session.user.email?.toLowerCase() === email) {
      return { success: false, error: "Você não pode convidar a si mesmo" }
    }

    return await prisma.$transaction(async (tx) => {
      const [organization, userOrg, existingInvite, existingMember] = await Promise.all([
        tx.organization.findUnique({ where: { id: organizationId } }),
        tx.user_Organization.findFirst({
          where: {
            user_id: session.user.id,
            organization_id: organizationId,
            role: { in: ["OWNER", "ADMIN"] },
          },
        }),
        tx.invite.findFirst({
          where: {
            AND: [
              { email },
              { organization_id: organizationId },
              { status: "PENDING" },
            ],
          },
        }),
        tx.user_Organization.findFirst({
          where: {
            organization_id: organizationId,
            user: { email },
          },
        }),
      ])

      if (!organization) {
        return { success: false, error: "Organização não encontrada" }
      }

      if (!userOrg) {
        return { success: false, error: "Você não tem permissão para convidar membros" }
      }

      if (existingInvite) {
        return { success: false, error: "Já existe um convite pendente para este email" }
      }

      if (existingMember) {
        return { success: false, error: "Este usuário já é membro da organização" }
      }

      const invite = await tx.invite.create({
        data: {
          id: randomUUID(),
          email,
          organization_id: organizationId,
          invited_by_id: session.user.id,
          role,
          expires_at: addDays(new Date(), 7),
        },
      })

      const emailSent = await sendInviteEmail(invite, organization)
      if (!emailSent) {
        await tx.invite.update({
          where: { id: invite.id },
          data: { status: "EXPIRED" },
        })
        return { success: false, error: "Erro ao enviar o email do convite" }
      }

      revalidatePath(`/${organization.uniqueId}`)
      return { success: true, inviteId: invite.id }
    })
  } catch (error) {
    logError("InviteMember", error, auth().then(s => s?.user?.id).catch(() => undefined))
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar convite",
    }
  }
}
