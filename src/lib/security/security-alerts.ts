import { securityMetrics, SecurityMetricType, MetricTimeWindow } from "./security-metrics"
import { auditLogger } from "../audit-logger"
import { prisma } from "../prisma"

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type AlertType = 
  | "excessive_access_denied"
  | "rate_limit_abuse"
  | "suspicious_user_activity"
  | "multiple_security_violations"
  | "unusual_invite_patterns"
  | "performance_degradation"
  | "authentication_anomaly"
  | "organization_access_spike"
  | "concurrent_operations_high"
  | "data_validation_failures"

export type SecurityAlert = {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  metadata: Record<string, any>
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
}

export type AlertThreshold = {
  type: AlertType
  metricType: SecurityMetricType
  threshold: number
  timeWindow: MetricTimeWindow
  severity: AlertSeverity
  enabled: boolean
}

/**
 * Security alerting system for monitoring and responding to security threats
 * Monitors metrics and triggers alerts based on configurable thresholds
 */
export class SecurityAlerts {
  private static instance: SecurityAlerts
  private alertsCache = new Map<string, SecurityAlert>()
  private isMonitoring = false
  private monitoringInterval?: NodeJS.Timeout
  
  // Default alert thresholds
  private readonly DEFAULT_THRESHOLDS: AlertThreshold[] = [
    {
      type: "excessive_access_denied",
      metricType: "access_denied_count",
      threshold: 10,
      timeWindow: "15m",
      severity: "HIGH",
      enabled: true
    },
    {
      type: "rate_limit_abuse",
      metricType: "rate_limit_exceeded_count",
      threshold: 5,
      timeWindow: "5m",
      severity: "MEDIUM",
      enabled: true
    },
    {
      type: "multiple_security_violations",
      metricType: "security_violations_count",
      threshold: 3,
      timeWindow: "1h",
      severity: "CRITICAL",
      enabled: true
    },
    {
      type: "performance_degradation",
      metricType: "operation_duration",
      threshold: 5000, // 5 seconds average
      timeWindow: "15m",
      severity: "MEDIUM",
      enabled: true
    },
    {
      type: "organization_access_spike",
      metricType: "organization_access_count",
      threshold: 100,
      timeWindow: "5m",
      severity: "LOW",
      enabled: true
    }
  ]
  
  private constructor() {}
  
  public static getInstance(): SecurityAlerts {
    if (!SecurityAlerts.instance) {
      SecurityAlerts.instance = new SecurityAlerts()
    }
    return SecurityAlerts.instance
  }
  
  /**
   * Start monitoring security metrics and triggering alerts
   */
  startMonitoring(intervalMs: number = 60000): void { // Default: 1 minute
    if (this.isMonitoring) {
      return
    }
    
    this.isMonitoring = true
    this.monitoringInterval = setInterval(async () => {
      await this.checkAllThresholds()
    }, intervalMs)
    
    console.log(`[SecurityAlerts] Started monitoring with ${intervalMs}ms interval`)
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    this.isMonitoring = false
    console.log("[SecurityAlerts] Stopped monitoring")
  }
  
  /**
   * Check all configured thresholds and trigger alerts
   */
  async checkAllThresholds(): Promise<void> {
    try {
      for (const threshold of this.DEFAULT_THRESHOLDS) {
        if (!threshold.enabled) continue
        
        await this.checkThreshold(threshold)
      }
      
      // Check for suspicious patterns
      await this.checkSuspiciousPatterns()
      
      // Clean up old resolved alerts
      await this.cleanupOldAlerts()
      
    } catch (error) {
      console.error("[SecurityAlerts] Error checking thresholds:", error)
      await auditLogger.logSystemError(
        undefined,
        error as Error,
        "security_alerts_threshold_check"
      )
    }
  }
  
  /**
   * Check a specific threshold and trigger alert if exceeded
   */
  async checkThreshold(threshold: AlertThreshold): Promise<void> {
    try {
      let currentValue: number
      
      switch (threshold.metricType) {
        case "access_denied_count":
          currentValue = await securityMetrics.getAccessDeniedCount(threshold.timeWindow)
          break
        case "rate_limit_exceeded_count":
          currentValue = await securityMetrics.getRateLimitExceededCount(threshold.timeWindow)
          break
        case "security_violations_count":
          const violations = await securityMetrics.getSecurityViolations(threshold.timeWindow)
          currentValue = violations.totalViolations
          break
        case "operation_duration":
          const performance = await securityMetrics.getOperationPerformanceMetrics(threshold.timeWindow)
          currentValue = performance.averageDuration
          break
        case "organization_access_count":
          const access = await securityMetrics.getOrganizationAccessMetrics(threshold.timeWindow)
          currentValue = access.totalAccess
          break
        default:
          return
      }
      
      if (currentValue >= threshold.threshold) {
        await this.triggerAlert(threshold, currentValue)
      }
      
    } catch (error) {
      console.error(`[SecurityAlerts] Error checking threshold ${threshold.type}:`, error)
    }
  }
  
  /**
   * Check for suspicious patterns that don't fit standard thresholds
   */
  async checkSuspiciousPatterns(): Promise<void> {
    try {
      // Check for users with multiple violations
      const violations = await securityMetrics.getSecurityViolations("1h")
      
      for (const suspiciousUserId of violations.suspiciousUsers) {
        const alertId = `suspicious_user_${suspiciousUserId}_${Date.now()}`
        
        if (!this.alertsCache.has(alertId)) {
          await this.createAlert({
            id: alertId,
            type: "suspicious_user_activity",
            severity: "HIGH",
            title: "Suspicious User Activity Detected",
            description: `User ${suspiciousUserId} has multiple security violations in the last hour`,
            metadata: {
              userId: suspiciousUserId,
              violationCount: violations.violationsByType,
              timeWindow: "1h"
            },
            timestamp: new Date(),
            resolved: false
          })
        }
      }
      
      // Check for unusual invite patterns
      const inviteMetrics = await securityMetrics.getInviteOperationMetrics("1h")
      const totalInvites = inviteMetrics.invitesSent
      const rejectionRate = totalInvites > 0 ? inviteMetrics.invitesRejected / totalInvites : 0
      
      if (totalInvites > 20 && rejectionRate > 0.5) {
        const alertId = `unusual_invite_patterns_${Date.now()}`
        
        if (!this.alertsCache.has(alertId)) {
          await this.createAlert({
            id: alertId,
            type: "unusual_invite_patterns",
            severity: "MEDIUM",
            title: "Unusual Invite Patterns Detected",
            description: `High rejection rate (${(rejectionRate * 100).toFixed(1)}%) for invites in the last hour`,
            metadata: {
              totalInvites,
              rejectionRate,
              inviteMetrics,
              timeWindow: "1h"
            },
            timestamp: new Date(),
            resolved: false
          })
        }
      }
      
      // Check for authentication anomalies
      const authFailures = await securityMetrics.getAccessDeniedCount("15m")
      const recentAccess = await securityMetrics.getOrganizationAccessMetrics("15m")
      
      if (authFailures > 0 && recentAccess.deniedAccess > recentAccess.successfulAccess) {
        const alertId = `authentication_anomaly_${Date.now()}`
        
        if (!this.alertsCache.has(alertId)) {
          await this.createAlert({
            id: alertId,
            type: "authentication_anomaly",
            severity: "HIGH",
            title: "Authentication Anomaly Detected",
            description: "More authentication failures than successes in the last 15 minutes",
            metadata: {
              authFailures,
              accessMetrics: recentAccess,
              timeWindow: "15m"
            },
            timestamp: new Date(),
            resolved: false
          })
        }
      }
      
    } catch (error) {
      console.error("[SecurityAlerts] Error checking suspicious patterns:", error)
    }
  }
  
  /**
   * Trigger an alert based on threshold violation
   */
  async triggerAlert(threshold: AlertThreshold, currentValue: number): Promise<void> {
    const alertId = `${threshold.type}_${threshold.timeWindow}_${Date.now()}`
    
    // Check if similar alert already exists and is not resolved
    const existingAlert = Array.from(this.alertsCache.values()).find(
      alert => alert.type === threshold.type && !alert.resolved &&
      Date.now() - alert.timestamp.getTime() < 300000 // 5 minutes
    )
    
    if (existingAlert) {
      return // Don't create duplicate alerts
    }
    
    const alert: SecurityAlert = {
      id: alertId,
      type: threshold.type,
      severity: threshold.severity,
      title: this.getAlertTitle(threshold.type),
      description: this.getAlertDescription(threshold.type, currentValue, threshold),
      metadata: {
        threshold: threshold.threshold,
        currentValue,
        timeWindow: threshold.timeWindow,
        metricType: threshold.metricType
      },
      timestamp: new Date(),
      resolved: false
    }
    
    await this.createAlert(alert)
  }
  
  /**
   * Create and store a new alert
   */
  async createAlert(alert: SecurityAlert): Promise<void> {
    try {
      // Store in cache
      this.alertsCache.set(alert.id, alert)
      
      // Log to audit system
      await auditLogger.logEvent("suspicious_activity_detected", {
        metadata: {
          alertId: alert.id,
          alertType: alert.type,
          alertSeverity: alert.severity,
          alertTitle: alert.title,
          alertDescription: alert.description,
          alertMetadata: alert.metadata,
          context: "security_alert_triggered"
        }
      })
      
      // Send notifications for high/critical alerts
      if (alert.severity === "HIGH" || alert.severity === "CRITICAL") {
        await this.sendAlertNotification(alert)
      }
      
      console.log(`[SecurityAlerts] Alert triggered: ${alert.type} (${alert.severity})`)
      
    } catch (error) {
      console.error("[SecurityAlerts] Error creating alert:", error)
    }
  }
  
  /**
   * Send alert notification (placeholder for integration with notification system)
   */
  async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    try {
      // In a real implementation, this would integrate with:
      // - Email notifications
      // - Slack/Teams webhooks
      // - SMS alerts
      // - Push notifications
      // - External monitoring systems (PagerDuty, etc.)
      
      console.log(`[SecurityAlerts] NOTIFICATION: ${alert.severity} alert - ${alert.title}`)
      console.log(`[SecurityAlerts] Description: ${alert.description}`)
      console.log(`[SecurityAlerts] Metadata:`, alert.metadata)
      
      // For now, create a system notification for admins
      const adminUsers = await prisma.user_Organization.findMany({
        where: {
          role: {
            in: ["OWNER", "ADMIN"]
          }
        },
        select: {
          user_id: true
        },
        distinct: ["user_id"]
      })
      
      for (const admin of adminUsers) {
        await prisma.notification.create({
          data: {
            user_id: admin.user_id,
            title: `Security Alert: ${alert.title}`,
            message: alert.description,
            type: "SYSTEM",
            linked_entity: alert.id,
            entity_type: "security_alert"
          }
        })
      }
      
    } catch (error) {
      console.error("[SecurityAlerts] Error sending alert notification:", error)
    }
  }
  
  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    const alert = this.alertsCache.get(alertId)
    if (!alert || alert.resolved) {
      return
    }
    
    alert.resolved = true
    alert.resolvedAt = new Date()
    alert.resolvedBy = resolvedBy
    
    this.alertsCache.set(alertId, alert)
    
    await auditLogger.logEvent("system_error", {
      userId: resolvedBy,
      metadata: {
        alertId,
        alertType: alert.type,
        context: "security_alert_resolved"
      }
    })
    
    console.log(`[SecurityAlerts] Alert resolved: ${alertId}`)
  }
  
  /**
   * Get all active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alertsCache.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        // Sort by severity (CRITICAL > HIGH > MEDIUM > LOW) then by timestamp
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
        if (severityDiff !== 0) return severityDiff
        return b.timestamp.getTime() - a.timestamp.getTime()
      })
  }
  
  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType): SecurityAlert[] {
    return Array.from(this.alertsCache.values())
      .filter(alert => alert.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
  
  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): SecurityAlert[] {
    return Array.from(this.alertsCache.values())
      .filter(alert => alert.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
  
  /**
   * Clean up old resolved alerts
   */
  async cleanupOldAlerts(): Promise<void> {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago
    
    for (const [alertId, alert] of this.alertsCache.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt.getTime() < cutoffTime) {
        this.alertsCache.delete(alertId)
      }
    }
  }
  
  private getAlertTitle(type: AlertType): string {
    const titles: Record<AlertType, string> = {
      excessive_access_denied: "Excessive Access Denied Attempts",
      rate_limit_abuse: "Rate Limit Abuse Detected",
      suspicious_user_activity: "Suspicious User Activity",
      multiple_security_violations: "Multiple Security Violations",
      unusual_invite_patterns: "Unusual Invite Patterns",
      performance_degradation: "Performance Degradation",
      authentication_anomaly: "Authentication Anomaly",
      organization_access_spike: "Organization Access Spike",
      concurrent_operations_high: "High Concurrent Operations",
      data_validation_failures: "Data Validation Failures"
    }
    
    return titles[type] || "Security Alert"
  }
  
  private getAlertDescription(type: AlertType, currentValue: number, threshold: AlertThreshold): string {
    const descriptions: Record<AlertType, string> = {
      excessive_access_denied: `${currentValue} access denied attempts in the last ${threshold.timeWindow} (threshold: ${threshold.threshold})`,
      rate_limit_abuse: `${currentValue} rate limit violations in the last ${threshold.timeWindow} (threshold: ${threshold.threshold})`,
      suspicious_user_activity: `Suspicious activity pattern detected with ${currentValue} violations`,
      multiple_security_violations: `${currentValue} security violations in the last ${threshold.timeWindow} (threshold: ${threshold.threshold})`,
      unusual_invite_patterns: `Unusual invite patterns detected with ${currentValue} operations`,
      performance_degradation: `Average operation duration is ${currentValue}ms in the last ${threshold.timeWindow} (threshold: ${threshold.threshold}ms)`,
      authentication_anomaly: `Authentication anomaly detected with ${currentValue} failures`,
      organization_access_spike: `${currentValue} organization access attempts in the last ${threshold.timeWindow} (threshold: ${threshold.threshold})`,
      concurrent_operations_high: `${currentValue} concurrent operations detected`,
      data_validation_failures: `${currentValue} data validation failures in the last ${threshold.timeWindow}`
    }
    
    return descriptions[type] || `Alert triggered with value ${currentValue}`
  }
}

// Export singleton instance
export const securityAlerts = SecurityAlerts.getInstance()

// Utility functions for common alert operations
export async function checkSecurityThresholds(): Promise<void> {
  await securityAlerts.checkAllThresholds()
}

export async function triggerCustomAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  const alert: SecurityAlert = {
    id: `custom_${type}_${Date.now()}`,
    type,
    severity,
    title,
    description,
    metadata: metadata || {},
    timestamp: new Date(),
    resolved: false
  }
  
  await securityAlerts.createAlert(alert)
}