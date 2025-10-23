import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { auditLogger } from "@/lib/audit-logger"
import { UniqueIdSchema } from "@/schemas/security"
import { z } from "zod"
import { permissionManager } from "@/lib/permission-manager"
import { getOrganizationByUniqueIdOptimized } from "@/lib/optimized-queries"
import { recordOperationDuration, incrementSecurityCounter } from "@/lib/security"

export async function getOrganizationByUniqueId(uniqueId: string) {
  const startTime = Date.now()
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
      organizationUniqueId: uniqueId,
      action: "getOrganizationByUniqueId"
    })
    await incrementSecurityCounter("access_denied_count", {
      reason: "not_authenticated",
      organizationUniqueId: uniqueId
    })
    redirect("/auth/login")
  }

  // Validate input
  try {
    UniqueIdSchema.parse(uniqueId)
  } catch (error) {
    await auditLogger.logValidationFailure(userId, "getOrganizationByUniqueId", 
      error instanceof z.ZodError ? error.errors : [], {
        organizationUniqueId: uniqueId
      })
    await incrementSecurityCounter("security_violations_count", {
      reason: "validation_failed",
      userId,
      organizationUniqueId: uniqueId
    })
    redirect("/")
  }

  const organization = await getOrganizationByUniqueIdOptimized(uniqueId)

  if (!organization) {
    await auditLogger.logSecurityViolation(userId, "Organization not found", {
      organizationUniqueId: uniqueId,
      action: "getOrganizationByUniqueId"
    })
    await incrementSecurityCounter("access_denied_count", {
      reason: "organization_not_found",
      userId,
      organizationUniqueId: uniqueId
    })
    redirect("/")
  }

  // Type assertion for the optimized query result
  const orgWithMembers = organization as typeof organization & {
    User_Organization: Array<{
      user_id: string
      organization_id: string
      role: any
      user: {
        id: string
        name: string | null
        email: string
        image: string | null
      }
    }>
    invites: Array<{
      id: string
      email: string
      role: any
      status: string
      expires_at: Date
      created_at: Date
      invited_by: {
        id: string
        name: string | null
        email: string
        image: string | null
      }
    }>
  }

  // Use PermissionManager to check access
  const canAccess = await permissionManager.canAccessOrganization(userId, orgWithMembers.id, {
    logFailure: true,
    context: "getOrganizationByUniqueId",
    metadata: {
      organizationUniqueId: uniqueId
    }
  })

  if (!canAccess) {
    await incrementSecurityCounter("access_denied_count", {
      reason: "permission_denied",
      userId,
      organizationId: orgWithMembers.id,
      organizationUniqueId: uniqueId
    })
    redirect("/")
  }

  // Get user role for response
  const userOrg = orgWithMembers.User_Organization.find(
    (uo) => uo.user_id === userId
  )

  if (!userOrg) {
    // This should not happen since we already validated access, but adding for type safety
    redirect("/")
  }

  // Log successful access
  await auditLogger.logOrganizationAccess(userId, orgWithMembers.id, "getOrganizationByUniqueId", true, {
    organizationUniqueId: uniqueId,
    userRole: userOrg.role
  })

  // Record operation performance metrics
  await recordOperationDuration("getOrganizationByUniqueId", startTime, {
    userId,
    organizationId: orgWithMembers.id,
    organizationUniqueId: uniqueId,
    userRole: userOrg.role,
    success: true
  })

  // Increment successful access counter
  await incrementSecurityCounter("organization_access_count", {
    userId,
    organizationId: orgWithMembers.id,
    organizationUniqueId: uniqueId,
    userRole: userOrg.role
  })

  const { User_Organization, ...orgWithoutMembers } = orgWithMembers

  return {
    ...orgWithoutMembers,
    members: User_Organization,
    invites: orgWithMembers.invites || [],
    userRole: userOrg.role
  }
} 