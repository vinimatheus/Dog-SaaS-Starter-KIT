"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OrganizationNameSchema, UniqueIdSchema } from "@/schemas/security"
import { auditLogger } from "@/lib/audit-logger"
import { permissionManager } from "@/lib/permission-manager"
import { cacheManager } from "@/lib/cache-manager"

const UpdateOrganizationActionSchema = z.object({
  name: OrganizationNameSchema,
  uniqueOrgId: UniqueIdSchema,
})

interface UpdateOrganizationResult {
  success: boolean
  error?: string
}

function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : ''
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
}

// Legacy checkOrganizationAccess function - replaced by PermissionManager
const checkOrganizationAccess = async (uniqueOrgId: string, userId: string) => {
  const organization = await prisma.organization.findUnique({
    where: { uniqueId: uniqueOrgId }
  })
  
  if (!organization) {
    throw new Error("Organização não encontrada ou você não tem permissão para editá-la.")
  }

  // Use PermissionManager to check modification permissions
  const canModify = await permissionManager.canModifyOrganization(userId, organization.id, {
    logFailure: true,
    context: "checkOrganizationAccess"
  })

  if (!canModify) {
    throw new Error("Organização não encontrada ou você não tem permissão para editá-la.")
  }
  
  return organization
}

export const updateOrganizationAction = async (
  formData: FormData
): Promise<UpdateOrganizationResult> => {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
        action: "updateOrganizationAction"
      })
      return { success: false, error: "Autenticação necessária" }
    }

    const validatedData = UpdateOrganizationActionSchema.safeParse({
      name: formData.get("name"),
      uniqueOrgId: formData.get("uniqueOrgId"),
    })

    if (!validatedData.success) {
      await auditLogger.logValidationFailure(session.user.id, "updateOrganizationAction", validatedData.error.errors)
      return { 
        success: false, 
        error: validatedData.error.errors[0].message 
      }
    }

    const { name, uniqueOrgId } = validatedData.data

    await prisma.$transaction(async (tx) => {
      const organization = await checkOrganizationAccess(uniqueOrgId, session.user.id)
      
      const oldName = organization.name
      
      await tx.organization.update({
        where: { id: organization.id },
        data: { name },
      })

      await auditLogger.logOrganizationManagement("organization_update", session.user.id, organization.id, name, {
        organizationUniqueId: uniqueOrgId,
        oldName,
        newName: name
      })

      // Invalidate cache after organization update
      await cacheManager.invalidateOrganizationCache(organization.id)
    })

    revalidatePath(`/${uniqueOrgId}`)
    revalidatePath("/", "layout")
    revalidatePath("/organizations", "layout")
    revalidatePath("/api/organizations")
    
    return { success: true }
  } catch (error) {
    const userId = await auth().then(s => s?.user?.id).catch(() => undefined)
    
    await auditLogger.logSystemError(userId, error instanceof Error ? error : new Error("Unknown error"), "updateOrganizationAction")
    
    logError("UpdateOrganization", error, userId)
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao atualizar organização" 
    }
  }
}
