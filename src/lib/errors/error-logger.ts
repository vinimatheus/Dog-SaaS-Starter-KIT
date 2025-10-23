// Structured error logging with detailed context and alerting
import { headers } from "next/headers"
import { auditLogger } from "@/lib/audit-logger"
import { OrganizationError, isSecurityError, isSystemError } from "./index"

/**
 * Enhanced error logging context
 */
export interface ErrorLoggingContext {
  // Request context
  userId?: string
  organizationId?: string
  sessionId?: string
  requestId?: string
  
  // HTTP context
  method?: string
  endpoint?: string
  userAgent?: string
  ip?: string
  referer?: string
  
  // Business context
  action?: string
  resource?: string
  feature?: string
  
  // Performance context
  duration?: number
  memoryUsage?: number
  
  // Additional metadata
  additionalData?: Record<string, any>
}

/**
 * Error log entry structure
 */
export interface ErrorLogEntry {
  // Error identification
  errorId: string
  errorType: string
  errorCode: string
  message: string
  userMessage: string
  
  // Classification
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'security' | 'validation' | 'business' | 'system' | 'external'
  
  // Timing
  timestamp: string
  
  // Context
  userId?: string
  organizationId?: string
  sessionId?: string
  requestId?: string
  
  // Request details
  method?: string
  endpoint?: string
  userAgent?: string
  ip?: string
  referer?: string
  
  // Business context
  action?: string
  resource?: string
  feature?: string
  
  // Performance metrics
  duration?: number
  memoryUsage?: number
  
  // Error details
  stack?: string
  metadata?: Record<string, any>
  
  // Alerting
  shouldAlert: boolean
  alertSent?: boolean
  
  // Additional context
  additionalData?: Record<string, any>
}

/**
 * Alert severity levels and their configurations
 */
export interface AlertConfiguration {
  enabled: boolean
  immediate: boolean // Send alert immediately vs batched
  channels: AlertChannel[]
  threshold?: number // Number of occurrences before alerting
  timeWindow?: number // Time window in minutes for threshold
  cooldown?: number // Cooldown period in minutes between alerts
}

export type AlertChannel = 'console' | 'email' | 'slack' | 'webhook' | 'database'

/**
 * Structured error logger with comprehensive context and alerting
 */
export class ErrorLogger {
  private static instance: ErrorLogger
  private alertHistory = new Map<string, { lastAlert: Date; count: number }>()
  
  private constructor() {}
  
  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger()
    }
    return ErrorLogger.instance
  }

  /**
   * Log error with comprehensive context and structured data
   */
  async logError(
    error: OrganizationError,
    context: ErrorLoggingContext = {}
  ): Promise<ErrorLogEntry> {
    try {
      // Gather request context automatically
      const requestContext = await this.gatherRequestContext()
      
      // Create comprehensive log entry
      const logEntry = await this.createLogEntry(error, {
        ...requestContext,
        ...context
      })
      
      // Log to various destinations
      await this.writeToDestinations(logEntry)
      
      // Handle alerting if needed
      if (logEntry.shouldAlert) {
        await this.handleAlerting(logEntry)
      }
      
      return logEntry
      
    } catch (loggingError) {
      // Fallback logging if structured logging fails
      console.error('[ErrorLogger] Failed to log error:', loggingError)
      console.error('[ErrorLogger] Original error:', error)
      
      // Return minimal log entry
      return {
        errorId: error.errorId,
        errorType: error.name,
        errorCode: error.code,
        message: error.message,
        userMessage: error.getUserMessage(),
        severity: error.getSeverity(),
        category: this.categorizeError(error),
        timestamp: new Date().toISOString(),
        shouldAlert: error.shouldAlert(),
        stack: error.stack,
        metadata: error.metadata
      }
    }
  }

  /**
   * Log security-specific errors with enhanced context
   */
  async logSecurityError(
    error: OrganizationError,
    context: ErrorLoggingContext = {}
  ): Promise<ErrorLogEntry> {
    const enhancedContext = {
      ...context,
      category: 'security' as const,
      feature: 'security_monitoring'
    }
    
    const logEntry = await this.logError(error, enhancedContext)
    
    // Additional security-specific logging
    await auditLogger.logSecurityViolation(
      error.userId || context.userId,
      error.message,
      {
        errorId: error.errorId,
        errorCode: error.code,
        severity: error.getSeverity(),
        organizationId: error.organizationId || context.organizationId,
        action: context.action,
        endpoint: context.endpoint,
        method: context.method,
        userAgent: context.userAgent,
        ip: context.ip,
        ...error.metadata
      }
    )
    
    return logEntry
  }

  /**
   * Log system errors with performance context
   */
  async logSystemError(
    error: OrganizationError,
    context: ErrorLoggingContext = {}
  ): Promise<ErrorLogEntry> {
    const enhancedContext = {
      ...context,
      category: 'system' as const,
      memoryUsage: this.getMemoryUsage()
    }
    
    const logEntry = await this.logError(error, enhancedContext)
    
    // Additional system-specific logging
    await auditLogger.logSystemError(
      error.userId || context.userId,
      error,
      context.action || 'system_operation',
      {
        errorId: error.errorId,
        severity: error.getSeverity(),
        memoryUsage: enhancedContext.memoryUsage,
        duration: context.duration,
        endpoint: context.endpoint,
        method: context.method
      }
    )
    
    return logEntry
  }

  /**
   * Batch log multiple errors (useful for bulk operations)
   */
  async logErrors(
    errors: { error: OrganizationError; context?: ErrorLoggingContext }[]
  ): Promise<ErrorLogEntry[]> {
    const logEntries: ErrorLogEntry[] = []
    
    for (const { error, context } of errors) {
      try {
        const logEntry = await this.logError(error, context)
        logEntries.push(logEntry)
      } catch (loggingError) {
        console.error('[ErrorLogger] Failed to log error in batch:', loggingError)
      }
    }
    
    return logEntries
  }

  /**
   * Create comprehensive log entry
   */
  private async createLogEntry(
    error: OrganizationError,
    context: ErrorLoggingContext
  ): Promise<ErrorLogEntry> {
    return {
      // Error identification
      errorId: error.errorId,
      errorType: error.name,
      errorCode: error.code,
      message: error.message,
      userMessage: error.getUserMessage(),
      
      // Classification
      severity: error.getSeverity(),
      category: this.categorizeError(error),
      
      // Timing
      timestamp: error.timestamp.toISOString(),
      
      // Context
      userId: error.userId || context.userId,
      organizationId: error.organizationId || context.organizationId,
      sessionId: context.sessionId,
      requestId: context.requestId,
      
      // Request details
      method: context.method,
      endpoint: context.endpoint,
      userAgent: context.userAgent,
      ip: context.ip,
      referer: context.referer,
      
      // Business context
      action: context.action,
      resource: context.resource,
      feature: context.feature,
      
      // Performance metrics
      duration: context.duration,
      memoryUsage: context.memoryUsage,
      
      // Error details
      stack: error.stack,
      metadata: error.metadata,
      
      // Alerting
      shouldAlert: error.shouldAlert(),
      
      // Additional context
      additionalData: context.additionalData
    }
  }

  /**
   * Gather request context automatically from Next.js headers
   */
  private async gatherRequestContext(): Promise<Partial<ErrorLoggingContext>> {
    try {
      const headersList = await headers()
      
      return {
        userAgent: headersList.get('user-agent') || undefined,
        ip: headersList.get('x-forwarded-for') || 
            headersList.get('x-real-ip') || 
            headersList.get('cf-connecting-ip') || undefined,
        referer: headersList.get('referer') || undefined,
        requestId: headersList.get('x-request-id') || 
                  headersList.get('x-correlation-id') || undefined
      }
    } catch (error) {
      // Headers not available (e.g., in server-side context)
      return {}
    }
  }

  /**
   * Categorize error for better organization
   */
  private categorizeError(error: OrganizationError): ErrorLogEntry['category'] {
    if (isSecurityError(error)) {
      return 'security'
    }
    
    if (error.code.includes('VALIDATION')) {
      return 'validation'
    }
    
    if (isSystemError(error)) {
      return 'system'
    }
    
    if (error.code.includes('EXTERNAL_SERVICE')) {
      return 'external'
    }
    
    return 'business'
  }

  /**
   * Write log entry to various destinations
   */
  private async writeToDestinations(logEntry: ErrorLogEntry): Promise<void> {
    // Console logging (always enabled in development)
    if (process.env.NODE_ENV === 'development' || logEntry.severity === 'critical') {
      this.writeToConsole(logEntry)
    }
    
    // Database logging (via audit logger)
    await this.writeToDatabase(logEntry)
    
    // File logging (if configured)
    if (process.env.ERROR_LOG_FILE) {
      await this.writeToFile(logEntry)
    }
    
    // External logging services (if configured)
    if (process.env.EXTERNAL_LOGGING_ENABLED === 'true') {
      await this.writeToExternalService(logEntry)
    }
  }

  /**
   * Write to console with structured format
   */
  private writeToConsole(logEntry: ErrorLogEntry): void {
    const logLevel = this.getConsoleLogLevel(logEntry.severity)
    const logMessage = this.formatConsoleMessage(logEntry)
    
    console[logLevel](logMessage, {
      errorId: logEntry.errorId,
      errorCode: logEntry.errorCode,
      severity: logEntry.severity,
      category: logEntry.category,
      userId: logEntry.userId,
      organizationId: logEntry.organizationId,
      action: logEntry.action,
      endpoint: logEntry.endpoint,
      metadata: logEntry.metadata
    })
  }

  /**
   * Write to database via audit logger
   */
  private async writeToDatabase(logEntry: ErrorLogEntry): Promise<void> {
    await auditLogger.logEvent('system_error', {
      userId: logEntry.userId,
      metadata: {
        errorId: logEntry.errorId,
        errorType: logEntry.errorType,
        errorCode: logEntry.errorCode,
        severity: logEntry.severity,
        category: logEntry.category,
        organizationId: logEntry.organizationId,
        action: logEntry.action,
        endpoint: logEntry.endpoint,
        method: logEntry.method,
        duration: logEntry.duration,
        memoryUsage: logEntry.memoryUsage,
        shouldAlert: logEntry.shouldAlert,
        ...logEntry.metadata
      }
    })
  }

  /**
   * Write to file (if configured)
   */
  private async writeToFile(logEntry: ErrorLogEntry): Promise<void> {
    // TODO: Implement file logging
    // This would write structured JSON logs to a file
    console.log('[ErrorLogger] File logging not implemented yet')
  }

  /**
   * Write to external logging service
   */
  private async writeToExternalService(logEntry: ErrorLogEntry): Promise<void> {
    // TODO: Implement external service logging (e.g., DataDog, New Relic, etc.)
    console.log('[ErrorLogger] External service logging not implemented yet')
  }

  /**
   * Handle alerting for critical errors
   */
  private async handleAlerting(logEntry: ErrorLogEntry): Promise<void> {
    const alertConfig = this.getAlertConfiguration(logEntry)
    
    if (!alertConfig.enabled) {
      return
    }
    
    const alertKey = `${logEntry.errorCode}_${logEntry.severity}`
    const shouldSendAlert = this.shouldSendAlert(alertKey, alertConfig)
    
    if (shouldSendAlert) {
      await this.sendAlert(logEntry, alertConfig)
      this.updateAlertHistory(alertKey)
    }
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(
    logEntry: ErrorLogEntry,
    config: AlertConfiguration
  ): Promise<void> {
    for (const channel of config.channels) {
      try {
        await this.sendAlertToChannel(logEntry, channel)
      } catch (error) {
        console.error(`[ErrorLogger] Failed to send alert to ${channel}:`, error)
      }
    }
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlertToChannel(
    logEntry: ErrorLogEntry,
    channel: AlertChannel
  ): Promise<void> {
    switch (channel) {
      case 'console':
        console.error(`[ALERT] ${logEntry.errorType}: ${logEntry.message}`, {
          errorId: logEntry.errorId,
          severity: logEntry.severity,
          userId: logEntry.userId,
          organizationId: logEntry.organizationId
        })
        break
        
      case 'database':
        await auditLogger.logEvent('security_violation', {
          userId: logEntry.userId,
          metadata: {
            alertType: 'error_alert',
            errorId: logEntry.errorId,
            severity: logEntry.severity,
            errorCode: logEntry.errorCode,
            message: logEntry.message
          }
        })
        break
        
      case 'email':
        // TODO: Implement email alerting
        console.log(`[ErrorLogger] Email alert not implemented: ${logEntry.errorId}`)
        break
        
      case 'slack':
        // TODO: Implement Slack alerting
        console.log(`[ErrorLogger] Slack alert not implemented: ${logEntry.errorId}`)
        break
        
      case 'webhook':
        // TODO: Implement webhook alerting
        console.log(`[ErrorLogger] Webhook alert not implemented: ${logEntry.errorId}`)
        break
    }
  }

  /**
   * Get alert configuration for error type
   */
  private getAlertConfiguration(logEntry: ErrorLogEntry): AlertConfiguration {
    // Default configurations based on severity and category
    const defaultConfigs: Record<string, AlertConfiguration> = {
      'critical_security': {
        enabled: true,
        immediate: true,
        channels: ['console', 'database', 'email', 'slack'],
        threshold: 1
      },
      'high_security': {
        enabled: true,
        immediate: false,
        channels: ['console', 'database', 'email'],
        threshold: 3,
        timeWindow: 15,
        cooldown: 30
      },
      'critical_system': {
        enabled: true,
        immediate: true,
        channels: ['console', 'database', 'email'],
        threshold: 1
      },
      'high_system': {
        enabled: true,
        immediate: false,
        channels: ['console', 'database'],
        threshold: 5,
        timeWindow: 10,
        cooldown: 60
      }
    }
    
    const configKey = `${logEntry.severity}_${logEntry.category}`
    return defaultConfigs[configKey] || {
      enabled: false,
      immediate: false,
      channels: ['console']
    }
  }

  /**
   * Determine if alert should be sent based on configuration and history
   */
  private shouldSendAlert(alertKey: string, config: AlertConfiguration): boolean {
    if (config.immediate) {
      return true
    }
    
    const history = this.alertHistory.get(alertKey)
    const now = new Date()
    
    if (!history) {
      return true // First occurrence
    }
    
    // Check cooldown period
    if (config.cooldown) {
      const cooldownEnd = new Date(history.lastAlert.getTime() + config.cooldown * 60 * 1000)
      if (now < cooldownEnd) {
        return false
      }
    }
    
    // Check threshold
    if (config.threshold && history.count >= config.threshold) {
      return true
    }
    
    return false
  }

  /**
   * Update alert history
   */
  private updateAlertHistory(alertKey: string): void {
    const existing = this.alertHistory.get(alertKey)
    
    if (existing) {
      existing.count++
      existing.lastAlert = new Date()
    } else {
      this.alertHistory.set(alertKey, {
        count: 1,
        lastAlert: new Date()
      })
    }
  }

  /**
   * Get console log level based on severity
   */
  private getConsoleLogLevel(severity: ErrorLogEntry['severity']): 'error' | 'warn' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error'
      case 'medium':
        return 'warn'
      case 'low':
        return 'info'
      default:
        return 'error'
    }
  }

  /**
   * Format console message
   */
  private formatConsoleMessage(logEntry: ErrorLogEntry): string {
    return `[${logEntry.severity.toUpperCase()}] ${logEntry.errorType} (${logEntry.errorCode}): ${logEntry.message}`
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }

  /**
   * Clean up old alert history (should be called periodically)
   */
  public cleanupAlertHistory(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    for (const [key, history] of this.alertHistory.entries()) {
      if (history.lastAlert < cutoff) {
        this.alertHistory.delete(key)
      }
    }
  }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance()

// Convenience functions
export async function logError(
  error: OrganizationError,
  context: ErrorLoggingContext = {}
): Promise<ErrorLogEntry> {
  return errorLogger.logError(error, context)
}

export async function logSecurityError(
  error: OrganizationError,
  context: ErrorLoggingContext = {}
): Promise<ErrorLogEntry> {
  return errorLogger.logSecurityError(error, context)
}

export async function logSystemError(
  error: OrganizationError,
  context: ErrorLoggingContext = {}
): Promise<ErrorLogEntry> {
  return errorLogger.logSystemError(error, context)
}