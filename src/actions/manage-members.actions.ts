"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Role } from "@prisma/client"
import { z } from "zod"
import { auditLogger } from "@/lib/audit-logger"
import { permissionManager } from "@/lib/permission-manager"
import { cacheManager } from "@/lib/cache-manager"

const MemberActionSchema = z.object({
  organizationId: z.string().min(1, "ID da organização é obrigatório"),
  targetUserId: z.string().min(1, "ID do usuário alvo é obrigatório"),
})

const RoleUpdateSchema = MemberActionSchema.extend({
  newRole: z.enum(["OWNER", "ADMIN", "USER"]),
})

interface ManageMemberResult {
  success: boolean
  error?: string
}

function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : ''
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
}



async function revalidateOrganizationPath(organizationId: string) {
  // Use cache manager to get organization data
  const organization = await cacheManager.getOrganizationData(organizationId)
  if (organization?.uniqueId) {
    revalidatePath(`/${organization.uniqueId}`)
    // Invalidate cache after member changes
    await cacheManager.invalidateOrganizationCache(organizationId)
  }
}

export async function updateMemberRoleAction(
  organizationIdRaw: string,
  targetUserIdRaw: string,
  newRoleRaw: Role
): Promise<ManageMemberResult> {
  try {
    const { organizationId, targetUserId, newRole } = RoleUpdateSchema.parse({
      organizationId: organizationIdRaw,
      targetUserId: targetUserIdRaw,
      newRole: newRoleRaw,
    })

    const session = await auth()
    if (!session?.user?.id) {
      await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
        action: "updateMemberRoleAction",
        organizationId,
        targetUserId
      })
      return { success: false, error: "Autenticação necessária" }
    }

    if (session.user.id === targetUserId) {
      return { success: false, error: "Você não pode alterar seu próprio cargo" }
    }

    return await prisma.$transaction(async (tx) => {
      try {
        await permissionManager.validateRole(session.user.id, organizationId, ["OWNER"], {
          logFailure: true,
          context: "updateMemberRoleAction"
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Permissão negada" }
      }

      const targetMember = await tx.user_Organization.findFirst({
        where: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      })

      if (!targetMember) {
        return { success: false, error: "Membro não encontrado" }
      }

      if (targetMember.role === "OWNER") {
        return { success: false, error: "Não é possível alterar o cargo do proprietário" }
      }

      await tx.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: targetUserId,
            organization_id: organizationId,
          },
        },
        data: { role: newRole },
      })

      await auditLogger.logMemberManagement("member_role_changed", session.user.id, organizationId, targetUserId, undefined, {
        oldRole: targetMember.role,
        newRole: newRole
      })

      await revalidateOrganizationPath(organizationId)
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    
    logError("UpdateMemberRole", error)
    return { success: false, error: error instanceof Error ? error.message : "Erro ao atualizar cargo" }
  }
}

export async function removeMemberAction(
  organizationIdRaw: string,
  targetUserIdRaw: string
): Promise<ManageMemberResult> {
  try {
    const { organizationId, targetUserId } = MemberActionSchema.parse({
      organizationId: organizationIdRaw,
      targetUserId: targetUserIdRaw,
    })

    const session = await auth()
    if (!session?.user?.id) {
      await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
        action: "removeMemberAction",
        organizationId,
        targetUserId
      })
      return { success: false, error: "Autenticação necessária" }
    }

    return await prisma.$transaction(async (tx) => {
      try {
        await permissionManager.validateRole(session.user.id, organizationId, ["OWNER", "ADMIN"], {
          logFailure: true,
          context: "removeMemberAction"
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Permissão negada" }
      }

      const targetMember = await tx.user_Organization.findFirst({
        where: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      })

      if (!targetMember) {
        return { success: false, error: "Membro não encontrado" }
      }

      if (targetMember.role === "OWNER") {
        return { success: false, error: "Não é possível remover o proprietário" }
      }

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

      await tx.user_Organization.delete({
        where: {
          user_id_organization_id: {
            user_id: targetUserId,
            organization_id: organizationId,
          },
        },
      })

      await tx.user.update({
        where: { id: targetUserId },
        data: { sessionVersion: { increment: 1 } }
      });

      await auditLogger.logMemberManagement("member_removed", session.user.id, organizationId, targetUserId, undefined, {
        removedRole: targetMember.role
      })

      await revalidateOrganizationPath(organizationId)
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    
    logError("RemoveMember", error)
    return { success: false, error: error instanceof Error ? error.message : "Erro ao remover membro" }
  }
}

export async function transferOwnershipAction(
  organizationIdRaw: string,
  newOwnerIdRaw: string
): Promise<ManageMemberResult> {
  try {
    const { organizationId, targetUserId: newOwnerId } = MemberActionSchema.parse({
      organizationId: organizationIdRaw,
      targetUserId: newOwnerIdRaw,
    })

    const session = await auth()
    if (!session?.user?.id) {
      await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
        action: "transferOwnershipAction",
        organizationId,
        targetUserId: newOwnerId
      })
      return { success: false, error: "Autenticação necessária" }
    }

    if (newOwnerId === session.user.id) {
      return { success: false, error: "Você já é o proprietário" }
    }

    return await prisma.$transaction(async (tx) => {
      try {
        await permissionManager.validateRole(session.user.id, organizationId, ["OWNER"], {
          logFailure: true,
          context: "transferOwnershipAction"
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Permissão negada" }
      }

      const newOwner = await tx.user_Organization.findFirst({
        where: {
          user_id: newOwnerId,
          organization_id: organizationId,
        },
      })

      if (!newOwner) {
        return { success: false, error: "Novo proprietário não encontrado na organização" }
      }

      await tx.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: newOwnerId,
            organization_id: organizationId,
          },
        },
        data: { role: "OWNER" },
      })

      await tx.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: session.user.id,
            organization_id: organizationId,
          },
        },
        data: { role: "ADMIN" },
      })

      await tx.organization.update({
        where: { id: organizationId },
        data: { owner_user_id: newOwnerId },
      })

      await auditLogger.logEvent("organization_ownership_transfer", {
        userId: session.user.id,
        metadata: {
          organizationId,
          previousOwnerId: session.user.id,
          newOwnerId,
          action: "transferOwnershipAction"
        }
      })

      await revalidateOrganizationPath(organizationId)
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    
    logError("TransferOwnership", error)
    return { success: false, error: error instanceof Error ? error.message : "Erro ao transferir propriedade" }
  }
}
