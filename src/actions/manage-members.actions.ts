"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Role } from "@prisma/client"
import { z } from "zod"
import { unstable_cache } from "next/cache"

// Schemas de validação
const MemberActionSchema = z.object({
  organizationId: z.string().uuid("ID de organização inválido"),
  targetUserId: z.string().uuid("ID de usuário inválido"),
})

const RoleUpdateSchema = MemberActionSchema.extend({
  newRole: z.enum(["OWNER", "ADMIN", "USER"], {
    invalid_type_error: "Cargo inválido",
  }),
})

interface ManageMemberResult {
  success: boolean
  error?: string
}

// Função segura para log sem expor dados sensíveis
function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : '';
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
  // Em produção, enviar para serviço de log estruturado
}

// Função memoizada para verificar permissões com cache
const checkPermission = unstable_cache(
  async (userId: string, organizationId: string, roles: Role[]) => {
    const userOrg = await prisma.user_Organization.findFirst({
      where: {
        user_id: userId,
        organization_id: organizationId,
        role: { in: roles },
      },
    })

    if (!userOrg) {
      throw new Error("Você não tem permissão para realizar esta ação")
    }

    return userOrg
  },
  ["member-permissions"],
  { revalidate: 60 } // Cache por 1 minuto
)

// Função memoizada para buscar informações da organização
const getOrganizationPath = unstable_cache(
  async (organizationId: string) => {
    const organization = await prisma.organization.findUnique({ 
      where: { id: organizationId },
      select: { uniqueId: true }
    })
    return organization?.uniqueId
  },
  ["organization-path"],
  { revalidate: 300 } // Cache por 5 minutos
)

async function revalidateOrganizationPath(organizationId: string) {
  const uniqueId = await getOrganizationPath(organizationId)
  if (uniqueId) {
    revalidatePath(`/${uniqueId}`)
  }
}

export async function updateMemberRoleAction(
  organizationIdRaw: string,
  targetUserIdRaw: string,
  newRoleRaw: Role
): Promise<ManageMemberResult> {
  try {
    // Validar os parâmetros
    const { organizationId, targetUserId, newRole } = RoleUpdateSchema.parse({
      organizationId: organizationIdRaw,
      targetUserId: targetUserIdRaw,
      newRole: newRoleRaw,
    })

    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Autenticação necessária" }
    }

    if (session.user.id === targetUserId) {
      return { success: false, error: "Você não pode alterar seu próprio cargo" }
    }

    // Usar transação para garantir consistência
    return await prisma.$transaction(async (tx) => {
      // Verificar permissões
      try {
        await checkPermission(session.user.id, organizationId, ["OWNER"])
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Permissão negada" }
      }

      // Verificar se o membro alvo existe
      const targetMember = await tx.user_Organization.findFirst({
        where: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      })

      if (!targetMember) {
        return { success: false, error: "Membro não encontrado" }
      }

      // Verificar se não é o proprietário
      if (targetMember.role === "OWNER") {
        return { success: false, error: "Não é possível alterar o cargo do proprietário" }
      }

      // Atualizar o papel do membro
      await tx.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: targetUserId,
            organization_id: organizationId,
          },
        },
        data: { role: newRole },
      })

      // Limpar cache
      await revalidateOrganizationPath(organizationId)
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }
    
    logError("UpdateMemberRole", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar cargo",
    }
  }
}

export async function removeMemberAction(
  organizationIdRaw: string,
  targetUserIdRaw: string
): Promise<ManageMemberResult> {
  try {
    // Validar os parâmetros
    const { organizationId, targetUserId } = MemberActionSchema.parse({
      organizationId: organizationIdRaw,
      targetUserId: targetUserIdRaw,
    })

    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Autenticação necessária" }
    }

    // Usar transação para garantir consistência
    return await prisma.$transaction(async (tx) => {
      // Verificar permissões
      try {
        await checkPermission(session.user.id, organizationId, ["OWNER", "ADMIN"])
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Permissão negada" }
      }

      // Verificar se o membro alvo existe
      const targetMember = await tx.user_Organization.findFirst({
        where: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      })

      if (!targetMember) {
        return { success: false, error: "Membro não encontrado" }
      }

      // Verificar se não é o proprietário
      if (targetMember.role === "OWNER") {
        return { success: false, error: "Não é possível remover o proprietário" }
      }

      // Verificar se admin tentando remover outro admin
      const currentUserOrg = await tx.user_Organization.findFirst({
        where: {
          user_id: session.user.id,
          organization_id: organizationId,
        },
        select: { role: true }
      })

      if (currentUserOrg?.role === "ADMIN" && targetMember.role === "ADMIN") {
        return { success: false, error: "Administradores não podem remover outros administradores" }
      }

      // Remover o membro
      await tx.user_Organization.delete({
        where: {
          user_id_organization_id: {
            user_id: targetUserId,
            organization_id: organizationId,
          },
        },
      })

      // Limpar cache
      await revalidateOrganizationPath(organizationId)
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }
    
    logError("RemoveMember", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao remover membro",
    }
  }
}

export async function transferOwnershipAction(
  organizationIdRaw: string,
  newOwnerIdRaw: string
): Promise<ManageMemberResult> {
  try {
    // Validar os parâmetros
    const { organizationId, targetUserId: newOwnerId } = MemberActionSchema.parse({
      organizationId: organizationIdRaw,
      targetUserId: newOwnerIdRaw,
    })

    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Autenticação necessária" }
    }

    if (newOwnerId === session.user.id) {
      return { success: false, error: "Você já é o proprietário" }
    }

    // Usar transação para garantir consistência
    return await prisma.$transaction(async (tx) => {
      // Verificar permissões
      try {
        await checkPermission(session.user.id, organizationId, ["OWNER"])
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Permissão negada" }
      }

      // Verificar se o novo proprietário existe na organização
      const newOwner = await tx.user_Organization.findFirst({
        where: {
          user_id: newOwnerId,
          organization_id: organizationId,
        },
      })

      if (!newOwner) {
        return { success: false, error: "Novo proprietário não encontrado na organização" }
      }

      // Atualizar proprietário
      await tx.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: newOwnerId,
            organization_id: organizationId,
          },
        },
        data: { role: "OWNER" },
      })
      
      // Rebaixar o atual proprietário para administrador
      await tx.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: session.user.id,
            organization_id: organizationId,
          },
        },
        data: { role: "ADMIN" },
      })
      
      // Atualizar o registro da organização
      await tx.organization.update({
        where: { id: organizationId },
        data: { owner_user_id: newOwnerId },
      })

      // Limpar cache
      await revalidateOrganizationPath(organizationId)
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }
    
    logError("TransferOwnership", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao transferir propriedade",
    }
  }
}