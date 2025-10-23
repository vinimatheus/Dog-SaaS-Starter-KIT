/**
 * Invite Cleanup Utility
 * 
 * Provides functionality for cleaning up expired invites and maintaining
 * invite data integrity according to requirements 2.2 and 2.4.
 */

import { prisma } from "@/lib/prisma"
import { auditLogger } from "@/lib/audit-logger"

export interface InviteCleanupResult {
  success: boolean
  cleanedCount: number
  error?: string
}

/**
 * Clean up expired invites from the database
 * This function should be called periodically to maintain data integrity
 */
export async function cleanupExpiredInvites(): Promise<InviteCleanupResult> {
  try {
    const now = new Date()
    
    // First, find all expired invites that are still marked as PENDING
    const expiredInvites = await prisma.invite.findMany({
      where: {
        status: "PENDING",
        expires_at: {
          lt: now
        }
      },
      select: {
        id: true,
        email: true,
        organization_id: true,
        expires_at: true
      }
    })

    if (expiredInvites.length === 0) {
      return {
        success: true,
        cleanedCount: 0
      }
    }

    // Update expired invites to EXPIRED status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update all expired invites to EXPIRED status
      const updateResult = await tx.invite.updateMany({
        where: {
          status: "PENDING",
          expires_at: {
            lt: now
          }
        },
        data: {
          status: "EXPIRED",
          updated_at: now
        }
      })

      // Log the cleanup operation for audit purposes
      await auditLogger.logEvent("invite_expired", {
        metadata: {
          cleanedCount: updateResult.count,
          expiredInviteIds: expiredInvites.map(inv => inv.id),
          cleanupTimestamp: now.toISOString()
        }
      })

      return updateResult.count
    })

    return {
      success: true,
      cleanedCount: result
    }
  } catch (error) {
    console.error("[InviteCleanup] Error cleaning up expired invites:", error)
    
    // Log the error for monitoring
    await auditLogger.logEvent("system_error", {
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      }
    }).catch(() => {
      // Ignore audit logging errors to prevent cascading failures
    })

    return {
      success: false,
      cleanedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error during cleanup"
    }
  }
}

/**
 * Remove old expired invites that have been expired for more than 30 days
 * This helps keep the database clean by removing stale data
 */
export async function removeOldExpiredInvites(): Promise<InviteCleanupResult> {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Find old expired invites
    const oldExpiredInvites = await prisma.invite.findMany({
      where: {
        status: "EXPIRED",
        updated_at: {
          lt: thirtyDaysAgo
        }
      },
      select: {
        id: true,
        email: true,
        organization_id: true
      }
    })

    if (oldExpiredInvites.length === 0) {
      return {
        success: true,
        cleanedCount: 0
      }
    }

    // Delete old expired invites in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.invite.deleteMany({
        where: {
          status: "EXPIRED",
          updated_at: {
            lt: thirtyDaysAgo
          }
        }
      })

      // Log the removal operation
      await auditLogger.logEvent("invite_deleted", {
        metadata: {
          removedCount: deleteResult.count,
          removedInviteIds: oldExpiredInvites.map(inv => inv.id),
          cleanupTimestamp: new Date().toISOString()
        }
      })

      return deleteResult.count
    })

    return {
      success: true,
      cleanedCount: result
    }
  } catch (error) {
    console.error("[InviteCleanup] Error removing old expired invites:", error)
    
    await auditLogger.logEvent("system_error", {
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      }
    }).catch(() => {
      // Ignore audit logging errors
    })

    return {
      success: false,
      cleanedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error during removal"
    }
  }
}

/**
 * Check if an invite is expired and update its status if needed
 * This function should be called before processing any invite operations
 */
export async function checkAndUpdateExpiredInvite(inviteId: string): Promise<boolean> {
  try {
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        status: true,
        expires_at: true,
        email: true,
        organization_id: true
      }
    })

    if (!invite) {
      return false
    }

    // If invite is already not pending, no need to check expiration
    if (invite.status !== "PENDING") {
      return invite.status !== "EXPIRED"
    }

    // Check if invite is expired
    const now = new Date()
    if (invite.expires_at < now) {
      // Update the invite status to EXPIRED
      await prisma.invite.update({
        where: { id: inviteId },
        data: {
          status: "EXPIRED",
          updated_at: now
        }
      })

      // Log the expiration using system event instead
      await auditLogger.logEvent("invite_expired", {
        metadata: {
          inviteId,
          organizationId: invite.organization_id,
          inviteEmail: invite.email,
          expiredAt: now.toISOString(),
          originalExpiryDate: invite.expires_at.toISOString(),
          cleanupType: "automatic"
        }
      })

      return false
    }

    return true
  } catch (error) {
    console.error("[InviteCleanup] Error checking invite expiration:", error)
    return false
  }
}

/**
 * Get statistics about invite cleanup operations
 * Useful for monitoring and reporting
 */
export async function getInviteCleanupStats() {
  try {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      totalPendingInvites,
      expiredPendingInvites,
      totalExpiredInvites,
      recentCleanupEvents
    ] = await Promise.all([
      prisma.invite.count({
        where: { status: "PENDING" }
      }),
      prisma.invite.count({
        where: {
          status: "PENDING",
          expires_at: { lt: now }
        }
      }),
      prisma.invite.count({
        where: { status: "EXPIRED" }
      }),
      prisma.securityLog.count({
        where: {
          eventType: {
            in: ["invite_cleanup_expired", "invite_cleanup_removed_old"]
          },
          createdAt: { gte: oneDayAgo }
        }
      })
    ])

    return {
      totalPendingInvites,
      expiredPendingInvites,
      totalExpiredInvites,
      recentCleanupEvents,
      needsCleanup: expiredPendingInvites > 0
    }
  } catch (error) {
    console.error("[InviteCleanup] Error getting cleanup stats:", error)
    return {
      totalPendingInvites: 0,
      expiredPendingInvites: 0,
      totalExpiredInvites: 0,
      recentCleanupEvents: 0,
      needsCleanup: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}