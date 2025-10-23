import { Organization, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { UserPermissions } from "@/lib/permission-manager"

export interface CacheEntry<T> {
  data: T
  expires: number
  version: number
}

export interface OrganizationCacheData {
  id: string
  name: string
  uniqueId: string
  plan: string | null
}

export interface CacheManagerConfig {
  defaultTTL: number // Time to live in milliseconds
  maxCacheSize: number // Maximum number of entries per cache type
  cleanupInterval: number // Cleanup interval in milliseconds
}

export class CacheManager {
  private static instance: CacheManager
  private permissionCache = new Map<string, CacheEntry<UserPermissions>>()
  private organizationCache = new Map<string, CacheEntry<OrganizationCacheData>>()
  private userOrganizationsCache = new Map<string, CacheEntry<string[]>>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private cacheVersion = 1

  private config: CacheManagerConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxCacheSize: 1000,
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
  }

  private constructor(config?: Partial<CacheManagerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
    this.startCleanupTimer()
  }

  public static getInstance(config?: Partial<CacheManagerConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config)
    }
    return CacheManager.instance
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries()
    }, this.config.cleanupInterval)
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now()

    // Clean permission cache
    for (const [key, entry] of this.permissionCache.entries()) {
      if (entry.expires < now) {
        this.permissionCache.delete(key)
      }
    }

    // Clean organization cache
    for (const [key, entry] of this.organizationCache.entries()) {
      if (entry.expires < now) {
        this.organizationCache.delete(key)
      }
    }

    // Clean user organizations cache
    for (const [key, entry] of this.userOrganizationsCache.entries()) {
      if (entry.expires < now) {
        this.userOrganizationsCache.delete(key)
      }
    }
  }

  /**
   * Enforce cache size limits
   */
  private enforceCacheSize<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size > this.config.maxCacheSize) {
      // Remove oldest entries (simple LRU-like behavior)
      const entries = Array.from(cache.entries())
      entries.sort((a, b) => a[1].expires - b[1].expires)
      
      const toRemove = entries.slice(0, cache.size - this.config.maxCacheSize)
      toRemove.forEach(([key]) => cache.delete(key))
    }
  }

  /**
   * Generate cache key for user permissions
   */
  private getPermissionCacheKey(userId: string, organizationId: string): string {
    return `perm:${userId}:${organizationId}`
  }

  /**
   * Generate cache key for organization data
   */
  private getOrganizationCacheKey(organizationId: string): string {
    return `org:${organizationId}`
  }

  /**
   * Generate cache key for user organizations
   */
  private getUserOrganizationsCacheKey(userId: string): string {
    return `user_orgs:${userId}`
  }

  /**
   * Get user permissions from cache or database
   */
  public async getUserPermissions(
    userId: string, 
    organizationId: string
  ): Promise<UserPermissions | null> {
    const cacheKey = this.getPermissionCacheKey(userId, organizationId)
    const cached = this.permissionCache.get(cacheKey)

    // Return cached data if valid and not expired
    if (cached && cached.expires > Date.now() && cached.version === this.cacheVersion) {
      return cached.data
    }

    // Fetch from database
    try {
      const userOrg = await prisma.user_Organization.findFirst({
        where: {
          user_id: userId,
          organization_id: organizationId,
        },
        select: {
          role: true,
        },
      })

      if (!userOrg) {
        return null
      }

      const role = userOrg.role
      const permissions: UserPermissions = {
        userId,
        organizationId,
        role,
        canAccessOrganization: true,
        canManageMembers: role === "OWNER" || role === "ADMIN",
        canSendInvites: role === "OWNER" || role === "ADMIN",
        canModifyOrganization: role === "OWNER" || role === "ADMIN",
        canManageSubscription: role === "OWNER",
        canTransferOwnership: role === "OWNER",
      }

      // Cache the result
      this.permissionCache.set(cacheKey, {
        data: permissions,
        expires: Date.now() + this.config.defaultTTL,
        version: this.cacheVersion,
      })

      this.enforceCacheSize(this.permissionCache)
      return permissions
    } catch (error) {
      console.error("Error fetching user permissions:", error)
      return null
    }
  }

  /**
   * Get organization data from cache or database
   */
  public async getOrganizationData(organizationId: string): Promise<OrganizationCacheData | null> {
    const cacheKey = this.getOrganizationCacheKey(organizationId)
    const cached = this.organizationCache.get(cacheKey)

    // Return cached data if valid and not expired
    if (cached && cached.expires > Date.now() && cached.version === this.cacheVersion) {
      return cached.data
    }

    // Fetch from database
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          uniqueId: true,
          plan: true,
        },
      })

      if (!organization) {
        return null
      }

      // Cache the result
      this.organizationCache.set(cacheKey, {
        data: organization,
        expires: Date.now() + this.config.defaultTTL,
        version: this.cacheVersion,
      })

      this.enforceCacheSize(this.organizationCache)
      return organization
    } catch (error) {
      console.error("Error fetching organization data:", error)
      return null
    }
  }

  /**
   * Get user's organization IDs from cache or database
   */
  public async getUserOrganizations(userId: string): Promise<string[]> {
    const cacheKey = this.getUserOrganizationsCacheKey(userId)
    const cached = this.userOrganizationsCache.get(cacheKey)

    // Return cached data if valid and not expired
    if (cached && cached.expires > Date.now() && cached.version === this.cacheVersion) {
      return cached.data
    }

    // Fetch from database
    try {
      const userOrgs = await prisma.user_Organization.findMany({
        where: { user_id: userId },
        select: { organization_id: true },
      })

      const organizationIds = userOrgs.map(uo => uo.organization_id)

      // Cache the result
      this.userOrganizationsCache.set(cacheKey, {
        data: organizationIds,
        expires: Date.now() + this.config.defaultTTL,
        version: this.cacheVersion,
      })

      this.enforceCacheSize(this.userOrganizationsCache)
      return organizationIds
    } catch (error) {
      console.error("Error fetching user organizations:", error)
      return []
    }
  }

  /**
   * Invalidate cache for specific user permissions
   */
  public async invalidateUserPermissions(userId: string, organizationId?: string): Promise<void> {
    if (organizationId) {
      // Invalidate specific user-organization permission
      const cacheKey = this.getPermissionCacheKey(userId, organizationId)
      this.permissionCache.delete(cacheKey)
    } else {
      // Invalidate all permissions for user
      for (const key of this.permissionCache.keys()) {
        if (key.startsWith(`perm:${userId}:`)) {
          this.permissionCache.delete(key)
        }
      }
    }

    // Also invalidate user organizations cache
    const userOrgsCacheKey = this.getUserOrganizationsCacheKey(userId)
    this.userOrganizationsCache.delete(userOrgsCacheKey)
  }

  /**
   * Invalidate cache for organization data
   */
  public async invalidateOrganizationData(organizationId: string): Promise<void> {
    const cacheKey = this.getOrganizationCacheKey(organizationId)
    this.organizationCache.delete(cacheKey)

    // Also invalidate all permissions related to this organization
    for (const key of this.permissionCache.keys()) {
      if (key.endsWith(`:${organizationId}`)) {
        this.permissionCache.delete(key)
      }
    }
  }

  /**
   * Invalidate all cache for a user (when user is removed from organization)
   */
  public async invalidateUserCache(userId: string): Promise<void> {
    // Remove all permission cache entries for this user
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`perm:${userId}:`)) {
        this.permissionCache.delete(key)
      }
    }

    // Remove user organizations cache
    const userOrgsCacheKey = this.getUserOrganizationsCacheKey(userId)
    this.userOrganizationsCache.delete(userOrgsCacheKey)
  }

  /**
   * Invalidate all cache for an organization (when organization is updated)
   */
  public async invalidateOrganizationCache(organizationId: string): Promise<void> {
    // Remove organization data cache
    const orgCacheKey = this.getOrganizationCacheKey(organizationId)
    this.organizationCache.delete(orgCacheKey)

    // Remove all permission cache entries for this organization
    for (const key of this.permissionCache.keys()) {
      if (key.endsWith(`:${organizationId}`)) {
        this.permissionCache.delete(key)
      }
    }

    // Remove user organizations cache for all users in this organization
    // Note: This is a broad invalidation, but ensures consistency
    this.userOrganizationsCache.clear()
  }

  /**
   * Clear all caches
   */
  public async clearAllCaches(): Promise<void> {
    this.permissionCache.clear()
    this.organizationCache.clear()
    this.userOrganizationsCache.clear()
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    permissions: { size: number; maxSize: number }
    organizations: { size: number; maxSize: number }
    userOrganizations: { size: number; maxSize: number }
    version: number
  } {
    return {
      permissions: {
        size: this.permissionCache.size,
        maxSize: this.config.maxCacheSize,
      },
      organizations: {
        size: this.organizationCache.size,
        maxSize: this.config.maxCacheSize,
      },
      userOrganizations: {
        size: this.userOrganizationsCache.size,
        maxSize: this.config.maxCacheSize,
      },
      version: this.cacheVersion,
    }
  }

  /**
   * Increment cache version to invalidate all cached data
   */
  public async invalidateAllCaches(): Promise<void> {
    this.cacheVersion++
    // Optionally clear the maps to free memory immediately
    this.clearAllCaches()
  }

  /**
   * Destroy the cache manager and cleanup resources
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.clearAllCaches()
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance()