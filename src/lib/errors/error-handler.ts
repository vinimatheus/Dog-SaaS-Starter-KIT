// Centralized error handler for consistent error processing and logging
import { ZodError } from "zod"
import { Prisma } from "@prisma/client"
import { auditLogger } from "@/lib/audit-logger"
import {
  OrganizationError,
  SecurityError,
  ValidationError,
  SystemError,
  DatabaseError,
  ExternalServiceError,
  ConfigurationError,
  isOrganizationError,
  isSecurityError,
  isValidationError,
  isSystemError
} from "./index"

/**
 * Error handling result for API responses
 */
export interface ErrorHandlingResult {
  success: false
  error: {
    message: string
    code: string
    errorId?: string
    details?: any
  }
  statusCode: number
}

/**
 * Error context for enhanced logging
 */
export interface ErrorContext {
  userId?: string
  organizationId?: string
  action?: string
  endpoint?: string
  method?: string
  userAgent?: string
  ip?: string
  sessionId?: string
  requestId?: string
  duration?: number
  additionalMetadata?: Record<string, any>
}

/**
 * Alert configuration for different error types
 */
interface AlertConfig {
  enabled: boolean
  channels: ('email' | 'slack' | 'webhook')[]
  threshold?: number
  timeWindow?: number // minutes
}

/**
 * Centralized error handler with comprehensive logging and alerting
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private alertCounts = new Map<string, { count: number; firstSeen: Date }>()
  
  private constructor() {}
  
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * Handle any error with comprehensive logging and appropriate response
   */
  async handleError(
    error: unknown,
    context: ErrorContext = {}
  ): Promise<ErrorHandlingResult> {
    try {
      // Convert unknown error to OrganizationError if possible
      const organizationError = this.normalizeError(error, context)
      
      // Log the error with full context
      await this.logError(organizationError, context)
      
      // Check if alerting is needed
      if (organizationError.shouldAlert()) {
        await this.handleAlerting(organizationError, context)
      }
      
      // Return appropriate API response
      return this.createErrorResponse(organizationError)
      
    } catch (handlingError) {
      // Fallback error handling if the error handler itself fails
      console.error('[ErrorHandler] Failed to handle error:', handlingError)
      console.error('[ErrorHandler] Original error:', error)
      
      return {
        success: false,
        error: {
          message: "Ocorreu um erro interno. Tente novamente em alguns instantes.",
          code: "INTERNAL_ERROR"
        },
        statusCode: 500
      }
    }
  }

  /**
   * Handle security-specific errors with enhanced logging
   */
  async handleSecurityError(
    error: SecurityError,
    context: ErrorContext = {}
  ): Promise<ErrorHandlingResult> {
    // Enhanced security logging
    await auditLogger.logSecurityViolation(
      error.userId,
      error.message,
      {
        code: error.code,
        errorId: error.errorId,
        organizationId: error.organizationId,
        action: context.action,
        endpoint: context.endpoint,
        method: context.method,
        userAgent: context.userAgent,
        ip: context.ip,
        ...error.metadata
      }
    )

    // Immediate alerting for critical security errors
    if (error.getSeverity() === 'critical') {
      await this.sendImmediateAlert(error, context)
    }

    return this.createErrorResponse(error)
  }

  /**
   * Handle validation errors from Zod or custom validation
   */
  async handleValidationError(
    error: ZodError | ValidationError,
    context: ErrorContext = {}
  ): Promise<ErrorHandlingResult> {
    let validationError: ValidationError

    if (error instanceof ZodError) {
      // Convert Zod error to ValidationError
      const firstError = error.errors[0]
      validationError = new ValidationError(
        firstError.message,
        firstError.path.join('.'),
        undefined,
        context.userId,
        context.organizationId
      )
    } else {
      validationError = error
    }

    // Log validation failure for monitoring
    await auditLogger.logValidationFailure(
      context.userId,
      context.action || 'unknown',
      error instanceof ZodError ? error.errors : [validationError.toJSON()],
      {
        endpoint: context.endpoint,
        method: context.method,
        errorId: validationError.errorId
      }
    )

    return this.createErrorResponse(validationError)
  }

  /**
   * Handle database errors (Prisma)
   */
  async handleDatabaseError(
    error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError,
    context: ErrorContext = {}
  ): Promise<ErrorHandlingResult> {
    let databaseError: DatabaseError

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
      const operation = this.getPrismaOperation(error.code)
      databaseError = new DatabaseError(
        operation,
        error,
        context.userId,
        context.organizationId
      )
    } else {
      // Handle unknown Prisma errors
      databaseError = new DatabaseError(
        'unknown_operation',
        error,
        context.userId,
        context.organizationId
      )
    }

    // Log system error
    await auditLogger.logSystemError(
      context.userId,
      databaseError,
      'database_operation',
      {
        endpoint: context.endpoint,
        method: context.method,
        errorId: databaseError.errorId,
        prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined
      }
    )

    return this.createErrorResponse(databaseError)
  }

  /**
   * Normalize any error to OrganizationError
   */
  private normalizeError(error: unknown, context: ErrorContext): OrganizationError {
    // Already an OrganizationError
    if (isOrganizationError(error)) {
      return error
    }

    // Zod validation error
    if (error instanceof ZodError) {
      const firstError = error.errors[0]
      return new ValidationError(
        firstError.message,
        firstError.path.join('.'),
        undefined,
        context.userId,
        context.organizationId
      )
    }

    // Prisma database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError || 
        error instanceof Prisma.PrismaClientUnknownRequestError) {
      const operation = error instanceof Prisma.PrismaClientKnownRequestError 
        ? this.getPrismaOperation(error.code)
        : 'unknown_operation'
      
      return new DatabaseError(
        operation,
        error,
        context.userId,
        context.organizationId
      )
    }

    // Standard JavaScript Error
    if (error instanceof Error) {
      return new SystemError(
        error.message,
        'SYSTEM_ERROR',
        error,
        context.userId,
        context.organizationId,
        context.action
      )
    }

    // Unknown error type
    return new SystemError(
      typeof error === 'string' ? error : 'Unknown error occurred',
      'UNKNOWN_ERROR',
      undefined,
      context.userId,
      context.organizationId,
      context.action
    )
  }

  /**
   * Log error with comprehensive context
   */
  private async logError(error: OrganizationError, context: ErrorContext): Promise<void> {
    const logData = {
      errorId: error.errorId,
      errorType: error.name,
      errorCode: error.code,
      message: error.message,
      severity: error.getSeverity(),
      userId: error.userId || context.userId,
      organizationId: error.organizationId || context.organizationId,
      timestamp: error.timestamp,
      context: {
        action: context.action,
        endpoint: context.endpoint,
        method: context.method,
        userAgent: context.userAgent,
        ip: context.ip,
        sessionId: context.sessionId,
        requestId: context.requestId
      },
      metadata: error.metadata,
      stack: error.stack
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ErrorHandler] ${error.name}:`, logData)
    }

    // Log to audit system
    await auditLogger.logSystemError(
      error.userId || context.userId,
      error,
      context.action || 'unknown',
      {
        errorId: error.errorId,
        severity: error.getSeverity(),
        endpoint: context.endpoint,
        method: context.method,
        ...context.additionalMetadata
      }
    )
  }

  /**
   * Handle alerting for critical errors
   */
  private async handleAlerting(error: OrganizationError, context: ErrorContext): Promise<void> {
    const alertKey = `${error.code}_${error.getSeverity()}`
    const now = new Date()
    
    // Track alert frequency
    const existing = this.alertCounts.get(alertKey)
    if (!existing) {
      this.alertCounts.set(alertKey, { count: 1, firstSeen: now })
    } else {
      existing.count++
    }

    // Determine if we should send alert based on configuration
    const shouldAlert = this.shouldSendAlert(error, existing?.count || 1)
    
    if (shouldAlert) {
      await this.sendAlert(error, context, existing?.count || 1)
    }
  }

  /**
   * Send immediate alert for critical errors
   */
  private async sendImmediateAlert(error: OrganizationError, context: ErrorContext): Promise<void> {
    // In a real implementation, this would integrate with alerting services
    console.error(`[CRITICAL ALERT] ${error.name}: ${error.message}`, {
      errorId: error.errorId,
      userId: error.userId,
      organizationId: error.organizationId,
      context,
      timestamp: error.timestamp
    })

    // TODO: Integrate with actual alerting services (email, Slack, PagerDuty, etc.)
    // await this.sendSlackAlert(error, context)
    // await this.sendEmailAlert(error, context)
  }

  /**
   * Send regular alert based on thresholds
   */
  private async sendAlert(error: OrganizationError, context: ErrorContext, count: number): Promise<void> {
    console.warn(`[ALERT] ${error.name} occurred ${count} times`, {
      errorId: error.errorId,
      severity: error.getSeverity(),
      context
    })

    // TODO: Implement actual alerting logic
  }

  /**
   * Determine if alert should be sent based on error type and frequency
   */
  private shouldSendAlert(error: OrganizationError, count: number): boolean {
    const config = this.getAlertConfig(error)
    
    if (!config.enabled) {
      return false
    }

    // Always alert for critical errors
    if (error.getSeverity() === 'critical') {
      return true
    }

    // Alert based on threshold
    if (config.threshold && count >= config.threshold) {
      return true
    }

    return false
  }

  /**
   * Get alert configuration for error type
   */
  private getAlertConfig(error: OrganizationError): AlertConfig {
    // Default configurations - in production, this would come from config
    const defaultConfigs: Record<string, AlertConfig> = {
      SecurityError: {
        enabled: true,
        channels: ['email', 'slack'],
        threshold: 1
      },
      SystemError: {
        enabled: true,
        channels: ['email'],
        threshold: 5,
        timeWindow: 15
      },
      ValidationError: {
        enabled: false,
        channels: []
      },
      BusinessLogicError: {
        enabled: false,
        channels: []
      }
    }

    return defaultConfigs[error.constructor.name] || {
      enabled: false,
      channels: []
    }
  }

  /**
   * Create API error response
   */
  private createErrorResponse(error: OrganizationError): ErrorHandlingResult {
    const statusCode = this.getHttpStatusCode(error)
    
    return {
      success: false,
      error: {
        message: error.getUserMessage(),
        code: error.code,
        errorId: error.errorId,
        ...(process.env.NODE_ENV === 'development' && {
          details: {
            originalMessage: error.message,
            metadata: error.metadata,
            stack: error.stack
          }
        })
      },
      statusCode
    }
  }

  /**
   * Get appropriate HTTP status code for error type
   */
  private getHttpStatusCode(error: OrganizationError): number {
    if (isSecurityError(error)) {
      switch (error.code) {
        case 'PERMISSION_DENIED':
        case 'UNAUTHORIZED_ACCESS':
          return 403
        case 'RATE_LIMIT_EXCEEDED':
          return 429
        default:
          return 401
      }
    }

    if (isValidationError(error)) {
      return 400
    }

    if (error.code === 'ORGANIZATION_NOT_FOUND' || 
        error.code === 'USER_NOT_FOUND' || 
        error.code === 'INVITE_NOT_FOUND') {
      return 404
    }

    if (error.code === 'MEMBER_ALREADY_EXISTS' || 
        error.code === 'INVITE_ALREADY_EXISTS') {
      return 409
    }

    if (isSystemError(error)) {
      return 500
    }

    return 400 // Default to bad request
  }

  /**
   * Get human-readable operation name from Prisma error code
   */
  private getPrismaOperation(code: string): string {
    const operations: Record<string, string> = {
      'P2002': 'unique_constraint_violation',
      'P2003': 'foreign_key_constraint_violation',
      'P2004': 'constraint_violation',
      'P2025': 'record_not_found',
      'P2016': 'query_interpretation_error',
      'P2017': 'relation_not_connected',
      'P2018': 'required_connected_records_not_found',
      'P2019': 'input_error',
      'P2020': 'value_out_of_range',
      'P2021': 'table_not_found',
      'P2022': 'column_not_found'
    }

    return operations[code] || 'unknown_database_operation'
  }

  /**
   * Clean up old alert counts (should be called periodically)
   */
  public cleanupAlertCounts(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    for (const [key, data] of this.alertCounts.entries()) {
      if (data.firstSeen < cutoff) {
        this.alertCounts.delete(key)
      }
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance()

// Convenience functions for common error handling scenarios
export async function handleSecurityError(
  error: SecurityError,
  context: ErrorContext = {}
): Promise<ErrorHandlingResult> {
  return errorHandler.handleSecurityError(error, context)
}

export async function handleValidationError(
  error: ZodError | ValidationError,
  context: ErrorContext = {}
): Promise<ErrorHandlingResult> {
  return errorHandler.handleValidationError(error, context)
}

export async function handleDatabaseError(
  error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError,
  context: ErrorContext = {}
): Promise<ErrorHandlingResult> {
  return errorHandler.handleDatabaseError(error, context)
}

export async function handleAnyError(
  error: unknown,
  context: ErrorContext = {}
): Promise<ErrorHandlingResult> {
  return errorHandler.handleError(error, context)
}