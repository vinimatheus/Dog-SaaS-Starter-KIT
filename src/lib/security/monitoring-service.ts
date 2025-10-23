import { securityAlerts } from "./security-alerts"
import { securityMetrics } from "./security-metrics"
import { auditLogger } from "../audit-logger"

/**
 * Security monitoring service that runs continuous monitoring
 * Can be started as a background service or scheduled job
 */
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService
  private isRunning = false
  private monitoringInterval?: NodeJS.Timeout
  private metricsCleanupInterval?: NodeJS.Timeout
  
  private constructor() {}
  
  public static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService()
    }
    return SecurityMonitoringService.instance
  }
  
  /**
   * Start the monitoring service
   */
  async start(options: {
    monitoringIntervalMs?: number
    cleanupIntervalMs?: number
    enableAlerts?: boolean
  } = {}): Promise<void> {
    if (this.isRunning) {
      console.log("[SecurityMonitoring] Service is already running")
      return
    }
    
    const {
      monitoringIntervalMs = 60000, // 1 minute
      cleanupIntervalMs = 300000,   // 5 minutes
      enableAlerts = true
    } = options
    
    this.isRunning = true
    
    console.log("[SecurityMonitoring] Starting security monitoring service...")
    
    // Start alert monitoring if enabled
    if (enableAlerts) {
      securityAlerts.startMonitoring(monitoringIntervalMs)
    }
    
    // Start periodic metrics collection
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics()
    }, monitoringIntervalMs)
    
    // Start periodic cleanup
    this.metricsCleanupInterval = setInterval(async () => {
      await this.performCleanup()
    }, cleanupIntervalMs)
    
    // Log service start
    await auditLogger.logEvent("system_error", {
      metadata: {
        action: "monitoring_service_started",
        monitoringIntervalMs,
        cleanupIntervalMs,
        enableAlerts,
        context: "security_monitoring"
      }
    })
    
    console.log("[SecurityMonitoring] Service started successfully")
  }
  
  /**
   * Stop the monitoring service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("[SecurityMonitoring] Service is not running")
      return
    }
    
    console.log("[SecurityMonitoring] Stopping security monitoring service...")
    
    this.isRunning = false
    
    // Stop alert monitoring
    securityAlerts.stopMonitoring()
    
    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval)
      this.metricsCleanupInterval = undefined
    }
    
    // Log service stop
    await auditLogger.logEvent("system_error", {
      metadata: {
        action: "monitoring_service_stopped",
        context: "security_monitoring"
      }
    })
    
    console.log("[SecurityMonitoring] Service stopped successfully")
  }
  
  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean
    uptime?: number
    lastMetricsCollection?: Date
    lastCleanup?: Date
  } {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() : undefined,
      lastMetricsCollection: this.lastMetricsCollection,
      lastCleanup: this.lastCleanup
    }
  }
  
  /**
   * Force metrics collection
   */
  async forceMetricsCollection(): Promise<void> {
    console.log("[SecurityMonitoring] Forcing metrics collection...")
    await this.collectMetrics()
  }
  
  /**
   * Force cleanup
   */
  async forceCleanup(): Promise<void> {
    console.log("[SecurityMonitoring] Forcing cleanup...")
    await this.performCleanup()
  }
  
  private lastMetricsCollection?: Date
  private lastCleanup?: Date
  
  /**
   * Collect security metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const startTime = Date.now()
      
      // Collect dashboard metrics to populate cache
      await securityMetrics.getSecurityDashboard("1h")
      
      // Record collection performance
      const duration = Date.now() - startTime
      await securityMetrics.recordMetric("operation_duration", duration, {
        operation: "metrics_collection",
        context: "monitoring_service"
      })
      
      this.lastMetricsCollection = new Date()
      
      // Log successful collection (only every 10th time to avoid spam)
      if (Math.random() < 0.1) {
        console.log(`[SecurityMonitoring] Metrics collected in ${duration}ms`)
      }
      
    } catch (error) {
      console.error("[SecurityMonitoring] Error collecting metrics:", error)
      
      await auditLogger.logSystemError(
        undefined,
        error as Error,
        "security_monitoring_metrics_collection"
      )
    }
  }
  
  /**
   * Perform cleanup operations
   */
  private async performCleanup(): Promise<void> {
    try {
      const startTime = Date.now()
      
      // Clean up expired metrics cache
      securityMetrics.clearExpiredCache()
      
      // Clean up old resolved alerts
      await securityAlerts.cleanupOldAlerts()
      
      const duration = Date.now() - startTime
      this.lastCleanup = new Date()
      
      // Log cleanup (only occasionally to avoid spam)
      if (Math.random() < 0.1) {
        console.log(`[SecurityMonitoring] Cleanup completed in ${duration}ms`)
      }
      
    } catch (error) {
      console.error("[SecurityMonitoring] Error during cleanup:", error)
      
      await auditLogger.logSystemError(
        undefined,
        error as Error,
        "security_monitoring_cleanup"
      )
    }
  }
}

// Export singleton instance
export const securityMonitoringService = SecurityMonitoringService.getInstance()

// Utility functions for easy service management
export async function startSecurityMonitoring(options?: {
  monitoringIntervalMs?: number
  cleanupIntervalMs?: number
  enableAlerts?: boolean
}): Promise<void> {
  await securityMonitoringService.start(options)
}

export async function stopSecurityMonitoring(): Promise<void> {
  await securityMonitoringService.stop()
}

export function getSecurityMonitoringStatus(): {
  isRunning: boolean
  uptime?: number
  lastMetricsCollection?: Date
  lastCleanup?: Date
} {
  return securityMonitoringService.getStatus()
}