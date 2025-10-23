import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { auditLogger } from "@/lib/audit-logger"
import { cacheManager } from "@/lib/cache-manager"

export interface UserPermissions {
  userId: string
  organizationId: string
  role: Role
  canAccessOrganization: boolean
  canManageMembers: boolean
  canSendInvites: boolean
  canModifyOrganization: boolean
  canManageSubscription: boolean
  canTransferOwnership: boolean
}

export interface PermissionCheckOptions {
  logFailure?: boolean
  context?: string
  metadata?: Record<string, any>
}

export class PermissionManager {
  private static instance: PermissionManager

  private constructor() {}

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager()
    }
    return PermissionManager.instance
  }

  /**
   * Get cached user permissions for an organization
   */
  private async getUserPermissionsFromCache(userId: string, organizationId: string): Promise<UserPermissions | null> {
    return await cacheManager.getUserPermissions(userId, organizationId)
  }

  /**
   * Check if user can access organization
   */
  public async canAccessOrganization(
    userId: string, 
    organizationId: string,
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissionsFromCache(userId, organizationId)
      const hasAccess = permissions?.canAccessOrganization ?? false

      if (!hasAccess && options.logFailure) {
        await auditLogger.logPermissionDenied(
          userId,
          options.context || "canAccessOrganization",
          "organization",
          undefined,
          undefined,
          {
            organizationId,
            ...options.metadata
          }
        )
      }

      return hasAccess
    } catch (error) {
      if (options.logFailure) {
        await auditLogger.logSystemError(
          userId,
          error instanceof Error ? error : new Error("Unknown error"),
          options.context || "canAccessOrganization"
        )
      }
      return false
    }
  }

  /**
   * Check if user can manage members (add, remove, change roles)
   */
  public async canManageMembers(
    userId: string, 
    organizationId: string,
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissionsFromCache(userId, organizationId)
      const canManage = permissions?.canManageMembers ?? false

      if (!canManage && options.logFailure) {
        await auditLogger.logPermissionDenied(
          userId,
          options.context || "canManageMembers",
          "organization",
          undefined,
          undefined,
          {
            organizationId,
            requiredRoles: ["ADMIN", "OWNER"],
            userRole: permissions?.role,
            ...options.metadata
          }
        )
      }

      return canManage
    } catch (error) {
      if (options.logFailure) {
        await auditLogger.logSystemError(
          userId,
          error instanceof Error ? error : new Error("Unknown error"),
          options.context || "canManageMembers"
        )
      }
      return false
    }
  }

  /**
   * Check if user can send invites
   */
  public async canSendInvites(
    userId: string, 
    organizationId: string,
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissionsFromCache(userId, organizationId)
      const canInvite = permissions?.canSendInvites ?? false

      if (!canInvite && options.logFailure) {
        await auditLogger.logPermissionDenied(
          userId,
          options.context || "canSendInvites",
          "organization",
          undefined,
          undefined,
          {
            organizationId,
            requiredRoles: ["ADMIN", "OWNER"],
            userRole: permissions?.role,
            ...options.metadata
          }
        )
      }

      return canInvite
    } catch (error) {
      if (options.logFailure) {
        await auditLogger.logSystemError(
          userId,
          error instanceof Error ? error : new Error("Unknown error"),
          options.context || "canSendInvites"
        )
      }
      return false
    }
  }

  /**
   * Check if user can modify organization settings
   */
  public async canModifyOrganization(
    userId: string, 
    organizationId: string,
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissionsFromCache(userId, organizationId)
      const canModify = permissions?.canModifyOrganization ?? false

      if (!canModify && options.logFailure) {
        await auditLogger.logPermissionDenied(
          userId,
          options.context || "canModifyOrganization",
          "organization",
          undefined,
          undefined,
          {
            organizationId,
            requiredRoles: ["ADMIN", "OWNER"],
            userRole: permissions?.role,
            ...options.metadata
          }
        )
      }

      return canModify
    } catch (error) {
      if (options.logFailure) {
        await auditLogger.logSystemError(
          userId,
          error instanceof Error ? error : new Error("Unknown error"),
          options.context || "canModifyOrganization"
        )
      }
      return false
    }
  }

  /**
   * Check if user can manage subscription (owner only)
   */
  public async canManageSubscription(
    userId: string, 
    organizationId: string,
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissionsFromCache(userId, organizationId)
      const canManage = permissions?.canManageSubscription ?? false

      if (!canManage && options.logFailure) {
        await auditLogger.logPermissionDenied(
          userId,
          options.context || "canManageSubscription",
          "organization",
          "OWNER",
          undefined,
          {
            organizationId,
            requiredRole: "OWNER",
            userRole: permissions?.role,
            ...options.metadata
          }
        )
      }

      return canManage
    } catch (error) {
      if (options.logFailure) {
        await auditLogger.logSystemError(
          userId,
          error instanceof Error ? error : new Error("Unknown error"),
          options.context || "canManageSubscription"
        )
      }
      return false
    }
  }

  /**
   * Check if user can transfer ownership (owner only)
   */
  public async canTransferOwnership(
    userId: string, 
    organizationId: string,
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissionsFromCache(userId, organizationId)
      const canTransfer = permissions?.canTransferOwnership ?? false

      if (!canTransfer && options.logFailure) {
        await auditLogger.logPermissionDenied(
          userId,
          options.context || "canTransferOwnership",
          "organization",
          "OWNER",
          undefined,
          {
            organizationId,
            requiredRole: "OWNER",
            userRole: permissions?.role,
            ...options.metadata
          }
        )
      }

      return canTransfer
    } catch (error) {
      if (options.logFailure) {
        await auditLogger.logSystemError(
          userId,
          error instanceof Error ? error : new Error("Unknown error"),
          options.context || "canTransferOwnership"
        )
      }
      return false
    }
  }

  /**
   * Get full user permissions for an organization
   */
  public async getUserPermissions(
    userId: string, 
    organizationId: string
  ): Promise<UserPermissions | null> {
    try {
      return await this.getUserPermissionsFromCache(userId, organizationId)
    } catch (error) {
      await auditLogger.logSystemError(
        userId,
        error instanceof Error ? error : new Error("Unknown error"),
        "getUserPermissions"
      )
      return null
    }
  }

  /**
   * Check if user has specific role(s) in organization
   */
  public async hasRole(
    userId: string, 
    organizationId: string, 
    roles: Role[],
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissionsFromCache(userId, organizationId)
      const hasRequiredRole = permissions ? roles.includes(permissions.role) : false

      if (!hasRequiredRole && options.logFailure) {
        await auditLogger.logPermissionDenied(
          userId,
          options.context || "hasRole",
          "organization",
          roles[0],
          undefined,
          {
            organizationId,
            requiredRoles: roles,
            userRole: permissions?.role,
            ...options.metadata
          }
        )
      }

      return hasRequiredRole
    } catch (error) {
      if (options.logFailure) {
        await auditLogger.logSystemError(
          userId,
          error instanceof Error ? error : new Error("Unknown error"),
          options.context || "hasRole"
        )
      }
      return false
    }
  }

  /**
   * Validate permission and throw error if denied
   */
  public async validatePermission(
    userId: string,
    organizationId: string,
    permission: keyof Pick<UserPermissions, 
      'canAccessOrganization' | 
      'canManageMembers' | 
      'canSendInvites' | 
      'canModifyOrganization' | 
      'canManageSubscription' | 
      'canTransferOwnership'
    >,
    options: PermissionCheckOptions = {}
  ): Promise<void> {
    let hasPermission = false

    switch (permission) {
      case 'canAccessOrganization':
        hasPermission = await this.canAccessOrganization(userId, organizationId, options)
        break
      case 'canManageMembers':
        hasPermission = await this.canManageMembers(userId, organizationId, options)
        break
      case 'canSendInvites':
        hasPermission = await this.canSendInvites(userId, organizationId, options)
        break
      case 'canModifyOrganization':
        hasPermission = await this.canModifyOrganization(userId, organizationId, options)
        break
      case 'canManageSubscription':
        hasPermission = await this.canManageSubscription(userId, organizationId, options)
        break
      case 'canTransferOwnership':
        hasPermission = await this.canTransferOwnership(userId, organizationId, options)
        break
    }

    if (!hasPermission) {
      throw new Error("Você não tem permissão para realizar esta ação")
    }
  }

  /**
   * Validate role and throw error if user doesn't have required role
   */
  public async validateRole(
    userId: string,
    organizationId: string,
    roles: Role[],
    options: PermissionCheckOptions = {}
  ): Promise<void> {
    const hasRequiredRole = await this.hasRole(userId, organizationId, roles, {
      ...options,
      logFailure: true
    })

    if (!hasRequiredRole) {
      throw new Error("Você não tem permissão para realizar esta ação")
    }
  }

  /**
   * Invalidate cache for user permissions
   */
  public async invalidateUserCache(userId: string): Promise<void> {
    await cacheManager.invalidateUserCache(userId)
  }

  /**
   * Invalidate cache for organization permissions
   */
  public async invalidateOrganizationCache(organizationId: string): Promise<void> {
    await cacheManager.invalidateOrganizationCache(organizationId)
  }
}

// Export singleton instance
export const permissionManager = PermissionManager.getInstance()