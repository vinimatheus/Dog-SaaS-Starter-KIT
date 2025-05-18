"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Role } from "@prisma/client"
import { z } from "zod"
import { unstable_cache } from "next/cache"

const MemberActionSchema = z.object({
  organizationId: z.string().uuid(),
  targetUserId: z.string().uuid(),
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
  { revalidate: 60 }
)

const getOrganizationPath = unstable_cache(
  async (organizationId: string) => {
    const organization = await prisma.organization.findUnique({ 
      where: { id: organizationId },
      select: { uniqueId: true }
    })
    return organization?.uniqueId
  },
  ["organization-path"],
  { revalidate: 300 }
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

    return await prisma.$transaction(async (tx) => {
      try {
        await checkPermission(session.user.id, organizationId, ["OWNER"])
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
      return { success: false, error: "Autenticação necessária" }
    }

    return await prisma.$transaction(async (tx) => {
      try {
        await checkPermission(session.user.id, organizationId, ["OWNER", "ADMIN"])
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
      return { success: false, error: "Autenticação necessária" }
    }

    if (newOwnerId === session.user.id) {
      return { success: false, error: "Você já é o proprietário" }
    }

    return await prisma.$transaction(async (tx) => {
      try {
        await checkPermission(session.user.id, organizationId, ["OWNER"])
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
