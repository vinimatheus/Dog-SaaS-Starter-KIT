"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Role, Prisma } from "@prisma/client"
import { z } from "zod"
import { unstable_cache } from "next/cache"

// Schema de validação para convites
const InviteTokenSchema = z.object({
  inviteId: z.string().uuid("ID de convite inválido"),
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

// Função segura para log sem expor dados sensíveis
function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : '';
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
  // Em produção, enviar para serviço de log estruturado
}

// Tipo para o resultado do convite
type InviteWithOrganization = NonNullable<Awaited<ReturnType<typeof getInvite>>>

// Função memoizada para buscar convite com cache
const getInvite = unstable_cache(
  async (inviteId: string) => {
    return prisma.invite.findUnique({
      where: { id: inviteId },
      include: { organization: true },
    })
  },
  ["invite-details"],
  { revalidate: 10 } // Cache por 10 segundos
)

// Validação de convite extraída em função pura para facilitar testes
function validateInvite(invite: InviteWithOrganization | null, userEmail: string): string | null {
  if (!invite) return "Convite não encontrado"

  if (invite.status !== "PENDING") {
    return `Este convite já foi ${statusMessages[invite.status] ?? "processado"}`
  }

  if (invite.expires_at < new Date()) return "Este convite expirou"

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) return "Este convite foi enviado para outro email"

  return null
}

// Função para registrar associação de usuário com organização
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
    // Validar ID do convite
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

    // Buscar o convite com cache
    const invite = await getInvite(inviteId)
    
    // Verificação preliminar do convite
    if (!invite) {
      return { success: false, error: "Convite não encontrado" }
    }

    // Usar transação para garantir consistência
    return await prisma.$transaction(async (tx) => {
      // Buscar o convite novamente dentro da transação para garantir dados atualizados
      const freshInvite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { organization: true },
      })

      // Validar o convite
      const validationError = validateInvite(freshInvite, userEmail)
      if (validationError) {
        // Se expirou, atualizar status
        if (validationError === "Este convite expirou" && freshInvite) {
          await tx.invite.update({
            where: { id: inviteId },
            data: { status: "EXPIRED" }
          })
        }
        return { success: false, error: validationError }
      }

      // Garantir que freshInvite não é nulo neste ponto
      if (!freshInvite) {
        return { success: false, error: "Convite não encontrado" }
      }

      // Registrar associação
      const membershipError = await registerMembership(tx, userId, freshInvite.organization.id, freshInvite.role as Role)
      if (membershipError) {
        return { success: false, error: membershipError }
      }

      // Marcar convite como aceito
      await tx.invite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED" },
      })

      // Limpar cache
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
