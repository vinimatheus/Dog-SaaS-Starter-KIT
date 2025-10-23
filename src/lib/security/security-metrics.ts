import { prisma } from "../prisma"
import { auditLogger } from "../audit-logger"

export type SecurityMetric = {
  name: string
  value: number
  timestamp: Date
  metadata?: Record<string, any>
}

export type SecurityMetricType = 
  | "access_denied_count"
  | "rate_limit_exceeded_count"
  | "organization_access_count"
  | "invite_operations_count"
  | "security_violations_count"
  | "authentication_failures_count"
  | "suspicious_activity_count"
  | "operation_duration"
  | "concurrent_operations"

export type MetricTimeWindow = "1m" | "5m" | "15m" | "1h" | "24h" | "7d" | "30d"

/**
 * Security metrics collector for monitoring system security health
 * Tracks access patterns, security violations, and performance metrics
 */
export class SecurityMetrics {
  private static instance: SecurityMetrics
  private metricsCache = new Map<string, SecurityMetric[]>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  
  private constructor() {}
  
  public static getInstance(): SecurityMetrics {
    if (!SecurityMetrics.instance) {
      SecurityMetrics.instance = new SecurityMetrics()
    }
    return SecurityMetrics.instance
  }
  
  /**
   * Record a security metric
   */
  async recordMetric(
    type: SecurityMetricType,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: SecurityMetric = {
      name: type,
      value,
      timestamp: new Date(),
      metadata
    }
    
    // Store in cache for real-time access
    const cacheKey = `${type}_recent`
    const cached = this.metricsCache.get(cacheKey) || []
    cached.push(metric)
    
    // Keep only last 100 entries per metric type
    if (cached.length > 100) {
      cached.splice(0, cached.length - 100)
    }
    
    this.metricsCache.set(cacheKey, cached)
    
    // Log to audit system for persistence
    await auditLogger.logEvent("system_error", {
      metadata: {
        metricType: type,
        metricValue: value,
        metricMetadata: metadata,
        context: "security_metric_recorded"
      }
    })
  }
  
  /**
   * Get access denied count for a time window
   */
  async getAccessDeniedCount(
    timeWindow: MetricTimeWindow,
    userId?: string,
    organizationId?: string
  ): Promise<number> {
    const startTime = this.getTimeWindowStart(timeWindow)
    
    const whereClause: any = {
      eventType: {
        in: ["unauthorized_organization_access", "permission_denied", "security_violation"]
      },
      createdAt: {
        gte: startTime
      }
    }
    
    if (userId) {
      whereClause.userId = userId
    }
    
    if (organizationId) {
      whereClause.metadata = {
        path: ["organizationId"],
        equals: organizationId
      }
    }
    
    const count = await prisma.securityLog.count({
      where: whereClause
    })
    
    await this.recordMetric("access_denied_count", count, {
      timeWindow,
      userId,
      organizationId
    })
    
    return count
  }
  
  /**
   * Get rate limit exceeded count for a time window
   */
  async getRateLimitExceededCount(
    timeWindow: MetricTimeWindow,
    userId?: string,
    action?: string
  ): Promise<number> {
    const startTime = this.getTimeWindowStart(timeWindow)
    
    const whereClause: any = {
      eventType: "rate_limit_exceeded",
      createdAt: {
        gte: startTime
      }
    }
    
    if (userId) {
      whereClause.userId = userId
    }
    
    if (action) {
      whereClause.metadata = {
        path: ["action"],
        equals: action
      }
    }
    
    const count = await prisma.securityLog.count({
      where: whereClause
    })
    
    await this.recordMetric("rate_limit_exceeded_count", count, {
      timeWindow,
      userId,
      action
    })
    
    return count
  }
  
  /**
   * Get organization access metrics
   */
  async getOrganizationAccessMetrics(
    timeWindow: MetricTimeWindow,
    organizationId?: string
  ): Promise<{
    totalAccess: number
    successfulAccess: number
    deniedAccess: number
    uniqueUsers: number
  }> {
    const startTime = this.getTimeWindowStart(timeWindow)
    
    const baseWhere: any = {
      eventType: {
        in: ["organization_access", "unauthorized_organization_access"]
      },
      createdAt: {
        gte: startTime
      }
    }
    
    if (organizationId) {
      baseWhere.metadata = {
        path: ["organizationId"],
        equals: organizationId
      }
    }
    
    const [totalLogs, successfulLogs, uniqueUsersResult] = await Promise.all([
      prisma.securityLog.count({ where: baseWhere }),
      prisma.securityLog.count({
        where: {
          ...baseWhere,
          eventType: "organization_access"
        }
      }),
      prisma.securityLog.findMany({
        where: baseWhere,
        select: { userId: true },
        distinct: ["userId"]
      })
    ])
    
    const metrics = {
      totalAccess: totalLogs,
      successfulAccess: successfulLogs,
      deniedAccess: totalLogs - successfulLogs,
      uniqueUsers: uniqueUsersResult.filter(u => u.userId).length
    }
    
    await this.recordMetric("organization_access_count", metrics.totalAccess, {
      timeWindow,
      organizationId,
      ...metrics
    })
    
    return metrics
  }
  
  /**
   * Get invite operation metrics
   */
  async getInviteOperationMetrics(
    timeWindow: MetricTimeWindow,
    organizationId?: string
  ): Promise<{
    invitesSent: number
    invitesAccepted: number
    invitesRejected: number
    invitesExpired: number
  }> {
    const startTime = this.getTimeWindowStart(timeWindow)
    
    const baseWhere: any = {
      eventType: {
        in: ["invite_sent", "invite_accepted", "invite_rejected", "invite_expired"]
      },
      createdAt: {
        gte: startTime
      }
    }
    
    if (organizationId) {
      baseWhere.metadata = {
        path: ["organizationId"],
        equals: organizationId
      }
    }
    
    const [sent, accepted, rejected, expired] = await Promise.all([
      prisma.securityLog.count({
        where: { ...baseWhere, eventType: "invite_sent" }
      }),
      prisma.securityLog.count({
        where: { ...baseWhere, eventType: "invite_accepted" }
      }),
      prisma.securityLog.count({
        where: { ...baseWhere, eventType: "invite_rejected" }
      }),
      prisma.securityLog.count({
        where: { ...baseWhere, eventType: "invite_expired" }
      })
    ])
    
    const metrics = {
      invitesSent: sent,
      invitesAccepted: accepted,
      invitesRejected: rejected,
      invitesExpired: expired
    }
    
    await this.recordMetric("invite_operations_count", sent + accepted + rejected + expired, {
      timeWindow,
      organizationId,
      ...metrics
    })
    
    return metrics
  }
  
  /**
   * Get security violations count and patterns
   */
  async getSecurityViolations(
    timeWindow: MetricTimeWindow,
    userId?: string
  ): Promise<{
    totalViolations: number
    violationsByType: Record<string, number>
    suspiciousUsers: string[]
  }> {
    const startTime = this.getTimeWindowStart(timeWindow)
    
    const whereClause: any = {
      eventType: {
        in: [
          "security_violation",
          "suspicious_activity_detected",
          "data_validation_failed",
          "unauthorized_organization_access",
          "permission_denied"
        ]
      },
      createdAt: {
        gte: startTime
      }
    }
    
    if (userId) {
      whereClause.userId = userId
    }
    
    const violations = await prisma.securityLog.findMany({
      where: whereClause,
      select: {
        eventType: true,
        userId: true,
        metadata: true
      }
    })
    
    const violationsByType: Record<string, number> = {}
    const userViolationCounts: Record<string, number> = {}
    
    violations.forEach(violation => {
      violationsByType[violation.eventType] = (violationsByType[violation.eventType] || 0) + 1
      
      if (violation.userId) {
        userViolationCounts[violation.userId] = (userViolationCounts[violation.userId] || 0) + 1
      }
    })
    
    // Users with more than 5 violations in the time window are considered suspicious
    const suspiciousUsers = Object.entries(userViolationCounts)
      .filter(([_, count]) => count > 5)
      .map(([userId, _]) => userId)
    
    const metrics = {
      totalViolations: violations.length,
      violationsByType,
      suspiciousUsers
    }
    
    await this.recordMetric("security_violations_count", metrics.totalViolations, {
      timeWindow,
      userId,
      ...metrics
    })
    
    return metrics
  }
  
  /**
   * Get operation performance metrics
   */
  async getOperationPerformanceMetrics(
    timeWindow: MetricTimeWindow,
    operation?: string
  ): Promise<{
    averageDuration: number
    maxDuration: number
    minDuration: number
    operationCount: number
  }> {
    const startTime = this.getTimeWindowStart(timeWindow)
    
    const whereClause: any = {
      createdAt: {
        gte: startTime
      },
      metadata: {
        path: ["duration"],
        not: null
      }
    }
    
    if (operation) {
      whereClause.metadata = {
        ...whereClause.metadata,
        path: ["action"],
        equals: operation
      }
    }
    
    const logs = await prisma.securityLog.findMany({
      where: whereClause,
      select: {
        metadata: true
      }
    })
    
    const durations = logs
      .map(log => (log.metadata as any)?.duration)
      .filter(duration => typeof duration === 'number')
    
    const metrics = {
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      operationCount: durations.length
    }
    
    await this.recordMetric("operation_duration", metrics.averageDuration, {
      timeWindow,
      operation,
      ...metrics
    })
    
    return metrics
  }
  
  /**
   * Get real-time metrics from cache
   */
  getRealtimeMetrics(type: SecurityMetricType, limit: number = 50): SecurityMetric[] {
    const cacheKey = `${type}_recent`
    const cached = this.metricsCache.get(cacheKey) || []
    return cached.slice(-limit)
  }
  
  /**
   * Clear old cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, metrics] of this.metricsCache.entries()) {
      const filtered = metrics.filter(metric => 
        now - metric.timestamp.getTime() < this.CACHE_TTL
      )
      if (filtered.length === 0) {
        this.metricsCache.delete(key)
      } else {
        this.metricsCache.set(key, filtered)
      }
    }
  }
  
  /**
   * Get comprehensive security dashboard metrics
   */
  async getSecurityDashboard(timeWindow: MetricTimeWindow = "24h"): Promise<{
    accessDenied: number
    rateLimitExceeded: number
    organizationAccess: {
      totalAccess: number
      successfulAccess: number
      deniedAccess: number
      uniqueUsers: number
    }
    inviteOperations: {
      invitesSent: number
      invitesAccepted: number
      invitesRejected: number
      invitesExpired: number
    }
    securityViolations: {
      totalViolations: number
      violationsByType: Record<string, number>
      suspiciousUsers: string[]
    }
    performance: {
      averageDuration: number
      maxDuration: number
      minDuration: number
      operationCount: number
    }
  }> {
    const [
      accessDenied,
      rateLimitExceeded,
      organizationAccess,
      inviteOperations,
      securityViolations,
      performance
    ] = await Promise.all([
      this.getAccessDeniedCount(timeWindow),
      this.getRateLimitExceededCount(timeWindow),
      this.getOrganizationAccessMetrics(timeWindow),
      this.getInviteOperationMetrics(timeWindow),
      this.getSecurityViolations(timeWindow),
      this.getOperationPerformanceMetrics(timeWindow)
    ])
    
    return {
      accessDenied,
      rateLimitExceeded,
      organizationAccess,
      inviteOperations,
      securityViolations,
      performance
    }
  }
  
  private getTimeWindowStart(timeWindow: MetricTimeWindow): Date {
    const now = new Date()
    const windowMs = this.parseTimeWindow(timeWindow)
    return new Date(now.getTime() - windowMs)
  }
  
  private parseTimeWindow(timeWindow: MetricTimeWindow): number {
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
}

// Export singleton instance
export const securityMetrics = SecurityMetrics.getInstance()

// Utility function to record operation duration
export async function recordOperationDuration(
  operation: string,
  startTime: number,
  metadata?: Record<string, any>
): Promise<void> {
  const duration = Date.now() - startTime
  await securityMetrics.recordMetric("operation_duration", duration, {
    operation,
    ...metadata
  })
}

// Utility function to increment counter metrics
export async function incrementSecurityCounter(
  type: SecurityMetricType,
  metadata?: Record<string, any>
): Promise<void> {
  await securityMetrics.recordMetric(type, 1, metadata)
}