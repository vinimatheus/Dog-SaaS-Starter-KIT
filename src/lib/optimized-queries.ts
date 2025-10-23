import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { cacheManager } from "@/lib/cache-manager"

/**
 * Optimized database queries with specific selects and proper indexing
 */

export interface OptimizedOrganizationData {
  id: string
  name: string
  uniqueId: string
  plan: string | null
  owner_user_id: string
}

export interface OptimizedUserOrganization {
  user_id: string
  organization_id: string
  role: Role
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

export interface OptimizedInviteData {
  id: string
  email: string
  role: Role
  status: string
  expires_at: Date
  created_at: Date
  invited_by: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

/**
 * Get organization by unique ID with optimized select
 */
export async function getOrganizationByUniqueIdOptimized(uniqueId: string) {
  return await prisma.organization.findUnique({
    where: { uniqueId },
    select: {
      id: true,
      name: true,
      uniqueId: true,
      plan: true,
      owner_user_id: true,
      User_Organization: {
        select: {
          user_id: true,
          organization_id: true,
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          role: 'asc', // OWNER first, then ADMIN, then USER
        },
      },
      invites: {
        where: {
          status: 'PENDING',
          expires_at: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expires_at: true,
          created_at: true,
          invited_by: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      },
    },
  })
}

/**
 * Get user's organizations with optimized select
 */
export async function getUserOrganizationsOptimized(userId: string) {
  return await prisma.user_Organization.findMany({
    where: { user_id: userId },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          uniqueId: true,
          plan: true,
        },
      },
    },
    orderBy: {
      organization: {
        name: 'asc',
      },
    },
  })
}

/**
 * Check if user has access to organization (optimized)
 */
export async function checkUserOrganizationAccessOptimized(
  userId: string,
  organizationId: string
): Promise<{ hasAccess: boolean; role?: Role }> {
  // Try cache first
  const cached = await cacheManager.getUserPermissions(userId, organizationId)
  if (cached) {
    return { hasAccess: cached.canAccessOrganization, role: cached.role }
  }

  // Fallback to database with optimized query
  const userOrg = await prisma.user_Organization.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
    select: {
      role: true,
    },
  })

  return {
    hasAccess: !!userOrg,
    role: userOrg?.role,
  }
}

/**
 * Get organization members with pagination and optimized select
 */
export async function getOrganizationMembersOptimized(
  organizationId: string,
  page: number = 1,
  limit: number = 50
) {
  const skip = (page - 1) * limit

  const [members, total] = await Promise.all([
    prisma.user_Organization.findMany({
      where: { organization_id: organizationId },
      select: {
        user_id: true,
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, then USER
        { user: { name: 'asc' } },
      ],
      skip,
      take: limit,
    }),
    prisma.user_Organization.count({
      where: { organization_id: organizationId },
    }),
  ])

  return {
    members,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Get pending invites for organization with optimized select
 */
export async function getOrganizationInvitesOptimized(organizationId: string) {
  return await prisma.invite.findMany({
    where: {
      organization_id: organizationId,
      status: 'PENDING',
      expires_at: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expires_at: true,
      created_at: true,
      invited_by: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })
}

/**
 * Get user's pending invites with optimized select
 */
export async function getUserPendingInvitesOptimized(email: string) {
  return await prisma.invite.findMany({
    where: {
      email,
      status: 'PENDING',
      expires_at: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      expires_at: true,
      created_at: true,
      organization: {
        select: {
          id: true,
          name: true,
          uniqueId: true,
        },
      },
      invited_by: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })
}

/**
 * Check if organization exists and get basic info (optimized)
 */
export async function checkOrganizationExistsOptimized(uniqueId: string) {
  return await prisma.organization.findUnique({
    where: { uniqueId },
    select: {
      id: true,
      name: true,
      uniqueId: true,
    },
  })
}

/**
 * Get organization statistics with optimized queries
 */
export async function getOrganizationStatsOptimized(organizationId: string) {
  const [memberCount, pendingInviteCount, adminCount] = await Promise.all([
    prisma.user_Organization.count({
      where: { organization_id: organizationId },
    }),
    prisma.invite.count({
      where: {
        organization_id: organizationId,
        status: 'PENDING',
        expires_at: {
          gt: new Date(),
        },
      },
    }),
    prisma.user_Organization.count({
      where: {
        organization_id: organizationId,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
    }),
  ])

  return {
    memberCount,
    pendingInviteCount,
    adminCount,
    userCount: memberCount - adminCount,
  }
}

/**
 * Batch check user permissions for multiple organizations
 */
export async function batchCheckUserPermissions(
  userId: string,
  organizationIds: string[]
): Promise<Map<string, { hasAccess: boolean; role?: Role }>> {
  const results = new Map<string, { hasAccess: boolean; role?: Role }>()

  // Try to get from cache first
  const cachePromises = organizationIds.map(async (orgId) => {
    const cached = await cacheManager.getUserPermissions(userId, orgId)
    if (cached) {
      results.set(orgId, { hasAccess: cached.canAccessOrganization, role: cached.role })
      return orgId
    }
    return null
  })

  const cachedOrgIds = (await Promise.all(cachePromises)).filter(Boolean) as string[]
  const uncachedOrgIds = organizationIds.filter(id => !cachedOrgIds.includes(id))

  // Batch query for uncached organizations
  if (uncachedOrgIds.length > 0) {
    const userOrgs = await prisma.user_Organization.findMany({
      where: {
        user_id: userId,
        organization_id: {
          in: uncachedOrgIds,
        },
      },
      select: {
        organization_id: true,
        role: true,
      },
    })

    // Set results for found organizations
    userOrgs.forEach(userOrg => {
      results.set(userOrg.organization_id, {
        hasAccess: true,
        role: userOrg.role,
      })
    })

    // Set no access for organizations not found
    uncachedOrgIds.forEach(orgId => {
      if (!results.has(orgId)) {
        results.set(orgId, { hasAccess: false })
      }
    })
  }

  return results
}

/**
 * Get recent security logs for organization with optimized select
 */
export async function getOrganizationSecurityLogsOptimized(
  organizationId: string,
  limit: number = 50
) {
  return await prisma.securityLog.findMany({
    where: {
      metadata: {
        path: ['organizationId'],
        equals: organizationId,
      },
    },
    select: {
      id: true,
      eventType: true,
      userId: true,
      ip: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  })
}

/**
 * Clean up expired invites (optimized batch operation)
 */
export async function cleanupExpiredInvitesOptimized() {
  const result = await prisma.invite.deleteMany({
    where: {
      OR: [
        {
          expires_at: {
            lt: new Date(),
          },
        },
        {
          status: 'EXPIRED',
        },
      ],
    },
  })

  return result.count
}

/**
 * Get user notifications with optimized select and pagination
 */
export async function getUserNotificationsOptimized(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        read: true,
        linked_entity: true,
        entity_type: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.notification.count({
      where: {
        user_id: userId,
        read: false,
      },
    }),
  ])

  return {
    notifications,
    unreadCount,
    page,
    limit,
  }
}