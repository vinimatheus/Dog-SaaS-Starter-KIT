/**
 * Portal Activity Logger
 * 
 * Tracks and logs customer portal activities for audit and analytics purposes
 */

import { auditLogger } from "@/lib/audit-logger"
import { prisma } from "@/lib/prisma"

export interface PortalActivity {
  organizationId: string
  userId?: string
  activityType: 'portal_accessed' | 'portal_returned' | 'payment_method_updated' | 'subscription_modified' | 'invoice_downloaded'
  metadata?: Record<string, any>
  timestamp?: Date
}

export interface PortalActivitySummary {
  organizationId: string
  totalActivities: number
  lastActivity: Date | null
  activitiesByType: Record<string, number>
  recentActivities: PortalActivity[]
}

/**
 * Log portal activity
 */
export async function logPortalActivity(activity: PortalActivity): Promise<void> {
  try {
    await auditLogger.logEvent('portal_activity', {
      userId: activity.userId,
      metadata: {
        organizationId: activity.organizationId,
        activityType: activity.activityType,
        timestamp: activity.timestamp || new Date(),
        context: 'customer_portal',
        ...activity.metadata
      }
    })
  } catch (error) {
    console.error('Failed to log portal activity:', error)
    // Don't throw - logging failures shouldn't break functionality
  }
}

/**
 * Get portal activity summary for an organization
 */
export async function getPortalActivitySummary(
  organizationId: string,
  daysBack: number = 30
): Promise<PortalActivitySummary> {
  try {
    const since = new Date()
    since.setDate(since.getDate() - daysBack)

    // This would typically query a dedicated portal_activities table
    // For now, we'll use a simplified approach with audit logs
    // In production, you might want to create a dedicated table for better performance

    const summary: PortalActivitySummary = {
      organizationId,
      totalActivities: 0,
      lastActivity: null,
      activitiesByType: {},
      recentActivities: []
    }

    // Note: This is a simplified implementation
    // In a real application, you'd want to query actual portal activity records
    return summary

  } catch (error) {
    console.error('Failed to get portal activity summary:', error)
    return {
      organizationId,
      totalActivities: 0,
      lastActivity: null,
      activitiesByType: {},
      recentActivities: []
    }
  }
}

/**
 * Track portal session start
 */
export async function trackPortalSessionStart(
  organizationId: string,
  userId: string,
  portalSessionId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logPortalActivity({
    organizationId,
    userId,
    activityType: 'portal_accessed',
    metadata: {
      portalSessionId,
      sessionStarted: true,
      ...metadata
    }
  })
}

/**
 * Track portal session end/return
 */
export async function trackPortalSessionEnd(
  organizationId: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logPortalActivity({
    organizationId,
    userId,
    activityType: 'portal_returned',
    metadata: {
      sessionEnded: true,
      ...metadata
    }
  })
}

/**
 * Track specific portal actions
 */
export async function trackPortalAction(
  organizationId: string,
  userId: string | undefined,
  action: 'payment_method_updated' | 'subscription_modified' | 'invoice_downloaded',
  metadata?: Record<string, any>
): Promise<void> {
  await logPortalActivity({
    organizationId,
    userId,
    activityType: action,
    metadata
  })
}

/**
 * Get recent portal activities for an organization
 */
export async function getRecentPortalActivities(
  organizationId: string,
  limit: number = 10
): Promise<PortalActivity[]> {
  try {
    // This would typically query a dedicated portal_activities table
    // For now, return empty array as we're using audit logs
    return []
  } catch (error) {
    console.error('Failed to get recent portal activities:', error)
    return []
  }
}