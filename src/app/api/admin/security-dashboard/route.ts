import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { securityMetrics, MetricTimeWindow } from "@/lib/security/security-metrics"
import { securityAlerts } from "@/lib/security/security-alerts"
import { auditLogger } from "@/lib/audit-logger"
import { prisma } from "@/lib/prisma"

/**
 * Security Dashboard API
 * Provides comprehensive security metrics and alerts for administrators
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      await auditLogger.logEvent("unauthorized_organization_access", {
        metadata: {
          endpoint: "/api/admin/security-dashboard",
          error: "No session found"
        }
      })
      
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Check if user is admin (has admin role in any organization)
    const userAdminRoles = await prisma.user_Organization.findMany({
      where: {
        user_id: session.user.id,
        role: {
          in: ["OWNER", "ADMIN"]
        }
      }
    })
    
    if (userAdminRoles.length === 0) {
      await auditLogger.logPermissionDenied(
        session.user.id,
        "access_security_dashboard",
        "security_dashboard",
        "ADMIN"
      )
      
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const timeWindow = (searchParams.get("timeWindow") as MetricTimeWindow) || "24h"
    const organizationId = searchParams.get("organizationId") || undefined
    
    // Validate time window
    const validTimeWindows: MetricTimeWindow[] = ["1m", "5m", "15m", "1h", "24h", "7d", "30d"]
    if (!validTimeWindows.includes(timeWindow)) {
      return NextResponse.json(
        { error: "Invalid time window" },
        { status: 400 }
      )
    }
    
    const startTime = Date.now()
    
    // Get comprehensive security dashboard data
    const [
      dashboardMetrics,
      activeAlerts,
      recentSecurityLogs,
      topViolatingUsers,
      organizationStats
    ] = await Promise.all([
      securityMetrics.getSecurityDashboard(timeWindow),
      securityAlerts.getActiveAlerts(),
      getRecentSecurityLogs(timeWindow, organizationId),
      getTopViolatingUsers(timeWindow),
      getOrganizationSecurityStats(timeWindow, organizationId)
    ])
    
    const duration = Date.now() - startTime
    
    // Log dashboard access
    await auditLogger.logEvent("organization_access", {
      userId: session.user.id,
      metadata: {
        action: "security_dashboard_access",
        timeWindow,
        organizationId,
        duration,
        metricsCount: Object.keys(dashboardMetrics).length,
        alertsCount: activeAlerts.length
      }
    })
    
    const response = {
      timeWindow,
      organizationId,
      timestamp: new Date().toISOString(),
      metrics: dashboardMetrics,
      alerts: {
        active: activeAlerts,
        summary: {
          total: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === "CRITICAL").length,
          high: activeAlerts.filter(a => a.severity === "HIGH").length,
          medium: activeAlerts.filter(a => a.severity === "MEDIUM").length,
          low: activeAlerts.filter(a => a.severity === "LOW").length
        }
      },
      recentActivity: recentSecurityLogs,
      topViolatingUsers,
      organizationStats,
      performance: {
        queryDuration: duration,
        cacheHits: 0, // Could be implemented with actual cache metrics
        totalQueries: 5
      }
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error("[SecurityDashboard] Error fetching dashboard data:", error)
    
    await auditLogger.logSystemError(
      undefined,
      error as Error,
      "security_dashboard_fetch"
    )
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Update alert status (resolve/acknowledge)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Check admin permissions
    const userAdminRoles = await prisma.user_Organization.findMany({
      where: {
        user_id: session.user.id,
        role: {
          in: ["OWNER", "ADMIN"]
        }
      }
    })
    
    if (userAdminRoles.length === 0) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const { alertId, action } = body
    
    if (!alertId || !action) {
      return NextResponse.json(
        { error: "Missing alertId or action" },
        { status: 400 }
      )
    }
    
    if (action === "resolve") {
      await securityAlerts.resolveAlert(alertId, session.user.id)
      
      await auditLogger.logEvent("system_error", {
        userId: session.user.id,
        metadata: {
          alertId,
          action: "alert_resolved",
          context: "security_dashboard"
        }
      })
      
      return NextResponse.json({ success: true, message: "Alert resolved" })
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
    
  } catch (error) {
    console.error("[SecurityDashboard] Error updating alert:", error)
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Get recent security logs for the dashboard
 */
async function getRecentSecurityLogs(
  timeWindow: MetricTimeWindow,
  organizationId?: string
): Promise<any[]> {
  const startTime = getTimeWindowStart(timeWindow)
  
  const whereClause: any = {
    createdAt: {
      gte: startTime
    },
    eventType: {
      in: [
        "unauthorized_organization_access",
        "permission_denied",
        "security_violation",
        "rate_limit_exceeded",
        "suspicious_activity_detected"
      ]
    }
  }
  
  if (organizationId) {
    whereClause.metadata = {
      path: ["organizationId"],
      equals: organizationId
    }
  }
  
  const logs = await prisma.securityLog.findMany({
    where: whereClause,
    orderBy: {
      createdAt: "desc"
    },
    take: 50,
    select: {
      id: true,
      eventType: true,
      userId: true,
      ip: true,
      metadata: true,
      createdAt: true
    }
  })
  
  return logs
}

/**
 * Get users with the most security violations
 */
async function getTopViolatingUsers(timeWindow: MetricTimeWindow): Promise<any[]> {
  const startTime = getTimeWindowStart(timeWindow)
  
  const logs = await prisma.securityLog.findMany({
    where: {
      createdAt: {
        gte: startTime
      },
      eventType: {
        in: [
          "unauthorized_organization_access",
          "permission_denied",
          "security_violation",
          "rate_limit_exceeded"
        ]
      },
      userId: {
        not: null
      }
    },
    select: {
      userId: true,
      eventType: true
    }
  })
  
  const userViolations: Record<string, { count: number; types: Record<string, number> }> = {}
  
  logs.forEach(log => {
    if (!log.userId) return
    
    if (!userViolations[log.userId]) {
      userViolations[log.userId] = { count: 0, types: {} }
    }
    
    userViolations[log.userId].count++
    userViolations[log.userId].types[log.eventType] = 
      (userViolations[log.userId].types[log.eventType] || 0) + 1
  })
  
  // Get top 10 violating users
  const topUsers = Object.entries(userViolations)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([userId, data]) => ({
      userId,
      violationCount: data.count,
      violationTypes: data.types
    }))
  
  return topUsers
}

/**
 * Get organization-specific security statistics
 */
async function getOrganizationSecurityStats(
  timeWindow: MetricTimeWindow,
  organizationId?: string
): Promise<any> {
  if (!organizationId) {
    // Return aggregate stats for all organizations
    const totalOrgs = await prisma.organization.count()
    const activeOrgs = await prisma.securityLog.findMany({
      where: {
        createdAt: {
          gte: getTimeWindowStart(timeWindow)
        },
        eventType: "organization_access"
      },
      select: {
        metadata: true
      }
    })
    
    const uniqueOrgs = new Set(
      activeOrgs
        .map(log => (log.metadata as any)?.organizationId)
        .filter(Boolean)
    )
    
    return {
      totalOrganizations: totalOrgs,
      activeOrganizations: uniqueOrgs.size,
      activityRate: totalOrgs > 0 ? (uniqueOrgs.size / totalOrgs) * 100 : 0
    }
  }
  
  // Return stats for specific organization
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      User_Organization: {
        select: {
          role: true
        }
      },
      invites: {
        where: {
          created_at: {
            gte: getTimeWindowStart(timeWindow)
          }
        }
      }
    }
  })
  
  if (!org) {
    return null
  }
  
  const securityEvents = await prisma.securityLog.count({
    where: {
      createdAt: {
        gte: getTimeWindowStart(timeWindow)
      },
      metadata: {
        path: ["organizationId"],
        equals: organizationId
      }
    }
  })
  
  return {
    organizationId: org.id,
    organizationName: org.name,
    memberCount: org.User_Organization.length,
    adminCount: org.User_Organization.filter(uo => uo.role === "ADMIN" || uo.role === "OWNER").length,
    recentInvites: org.invites.length,
    securityEvents
  }
}

/**
 * Helper function to get start time for a time window
 */
function getTimeWindowStart(timeWindow: MetricTimeWindow): Date {
  const now = new Date()
  const windowMs = parseTimeWindow(timeWindow)
  return new Date(now.getTime() - windowMs)
}

/**
 * Parse time window string to milliseconds
 */
function parseTimeWindow(timeWindow: MetricTimeWindow): number {
  const windowMap: Record<MetricTimeWindow, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000
  }
  
  return windowMap[timeWindow] || windowMap["24h"]
}