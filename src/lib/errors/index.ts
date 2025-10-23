// Enhanced error hierarchy for organization security system
import { Role } from "@prisma/client"
import { auditLogger } from "@/lib/audit-logger"

/**
 * Base error class for all organization-related errors
 * Provides structured error handling with audit logging capabilities
 */
export abstract class OrganizationError extends Error {
  public readonly timestamp: Date
  public readonly errorId: string
  
  constructor(
    message: string,
    public readonly code: string,
    public readonly userId?: string,
    public readonly organizationId?: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message)
    this.name = this.constructor.name
    this.timestamp = new Date()
    this.errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      errorId: this.errorId,
      timestamp: this.timestamp.toISOString(),
      userId: this.userId,
      organizationId: this.organizationId,
      metadata: this.metadata
    }
  }

  /**
   * Get user-safe error message (without sensitive details)
   */
  abstract getUserMessage(): string

  /**
   * Get error severity level for logging and alerting
   */
  abstract getSeverity(): 'low' | 'medium' | 'high' | 'critical'

  /**
   * Determine if error should trigger security alerts
   */
  abstract shouldAlert(): boolean
}

/**
 * Security-related errors (authentication, authorization, permissions)
 */
export class SecurityError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, metadata)
  }

  getUserMessage(): string {
    return "Acesso negado. Você não tem permissão para realizar esta ação."
  }

  getSeverity(): 'high' | 'critical' {
    return this.code.includes('CRITICAL') ? 'critical' : 'high'
  }

  shouldAlert(): boolean {
    return true // All security errors should trigger alerts
  }
}

/**
 * Permission denied errors
 */
export class PermissionDeniedError extends SecurityError {
  constructor(
    userId: string,
    action: string,
    organizationId?: string,
    requiredRole?: Role,
    userRole?: Role
  ) {
    super(
      `Permission denied for action: ${action}`,
      'PERMISSION_DENIED',
      userId,
      organizationId,
      { action, requiredRole, userRole }
    )
  }

  getUserMessage(): string {
    const action = this.metadata?.action
    return `Você não tem permissão para ${action || 'realizar esta ação'}.`
  }
}

/**
 * Unauthorized access errors
 */
export class UnauthorizedAccessError extends SecurityError {
  constructor(
    userId: string | undefined,
    resource: string,
    organizationId?: string,
    attemptedAction?: string
  ) {
    super(
      `Unauthorized access to ${resource}`,
      'UNAUTHORIZED_ACCESS',
      userId,
      organizationId,
      { resource, attemptedAction }
    )
  }

  getUserMessage(): string {
    return "Acesso não autorizado ao recurso solicitado."
  }

  getSeverity(): 'critical' {
    return 'critical'
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitExceededError extends OrganizationError {
  constructor(
    userId: string,
    action: string,
    retryAfter?: number,
    currentCount?: number,
    limit?: number
  ) {
    super(
      `Rate limit exceeded for action: ${action}`,
      'RATE_LIMIT_EXCEEDED',
      userId,
      undefined,
      { action, retryAfter, currentCount, limit }
    )
  }

  getUserMessage(): string {
    const retryAfter = this.metadata?.retryAfter
    return `Muitas tentativas. ${retryAfter ? `Tente novamente em ${retryAfter} segundos.` : 'Tente novamente mais tarde.'}`
  }

  getSeverity(): 'medium' {
    return 'medium'
  }

  shouldAlert(): boolean {
    // Alert only if rate limit is significantly exceeded
    const currentCount = this.metadata?.currentCount || 0
    const limit = this.metadata?.limit || 0
    return currentCount > limit * 2
  }
}

/**
 * Validation and input errors
 */
export class ValidationError extends OrganizationError {
  constructor(
    message: string,
    field?: string,
    value?: any,
    userId?: string,
    organizationId?: string
  ) {
    super(
      field ? `${field}: ${message}` : message,
      'VALIDATION_ERROR',
      userId,
      organizationId,
      { field, value }
    )
  }

  getUserMessage(): string {
    return this.message
  }

  getSeverity(): 'low' {
    return 'low'
  }

  shouldAlert(): boolean {
    return false
  }
}

/**
 * Business logic errors
 */
export class BusinessLogicError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, metadata)
  }

  getUserMessage(): string {
    return this.message
  }

  getSeverity(): 'medium' {
    return 'medium'
  }

  shouldAlert(): boolean {
    return false
  }
}

/**
 * Organization not found error
 */
export class OrganizationNotFoundError extends BusinessLogicError {
  constructor(organizationId: string, userId?: string) {
    super(
      `Organization not found: ${organizationId}`,
      'ORGANIZATION_NOT_FOUND',
      userId,
      organizationId
    )
  }

  getUserMessage(): string {
    return "Organização não encontrada."
  }
}

/**
 * User not found error
 */
export class UserNotFoundError extends BusinessLogicError {
  constructor(userId: string, context?: string) {
    super(
      `User not found: ${userId}`,
      'USER_NOT_FOUND',
      userId,
      undefined,
      { context }
    )
  }

  getUserMessage(): string {
    return "Usuário não encontrado."
  }
}

/**
 * Invite-related errors
 */
export class InviteError extends BusinessLogicError {
  constructor(
    message: string,
    code: string,
    inviteId?: string,
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, { inviteId, ...metadata })
  }
}

/**
 * Invite not found error
 */
export class InviteNotFoundError extends InviteError {
  constructor(inviteId: string, userId?: string) {
    super(
      `Invite not found: ${inviteId}`,
      'INVITE_NOT_FOUND',
      inviteId,
      userId
    )
  }

  getUserMessage(): string {
    return "Convite não encontrado ou expirado."
  }
}

/**
 * Invite already exists error
 */
export class InviteAlreadyExistsError extends InviteError {
  constructor(email: string, organizationId: string, userId?: string) {
    super(
      `Invite already exists for email: ${email}`,
      'INVITE_ALREADY_EXISTS',
      undefined,
      userId,
      organizationId,
      { email }
    )
  }

  getUserMessage(): string {
    return "Já existe um convite pendente para este email."
  }
}

/**
 * Invite expired error
 */
export class InviteExpiredError extends InviteError {
  constructor(inviteId: string, userId?: string, organizationId?: string) {
    super(
      `Invite expired: ${inviteId}`,
      'INVITE_EXPIRED',
      inviteId,
      userId,
      organizationId
    )
  }

  getUserMessage(): string {
    return "Este convite expirou. Solicite um novo convite."
  }
}

/**
 * Member already exists error
 */
export class MemberAlreadyExistsError extends BusinessLogicError {
  constructor(userId: string, organizationId: string) {
    super(
      `User is already a member of organization: ${organizationId}`,
      'MEMBER_ALREADY_EXISTS',
      userId,
      organizationId
    )
  }

  getUserMessage(): string {
    return "Usuário já é membro desta organização."
  }
}

/**
 * Plan limit exceeded error
 */
export class PlanLimitExceededError extends BusinessLogicError {
  constructor(
    planType: string,
    limitType: string,
    currentCount: number,
    maxAllowed: number,
    organizationId: string,
    userId?: string
  ) {
    super(
      `Plan limit exceeded: ${planType} plan allows maximum ${maxAllowed} ${limitType}, current: ${currentCount}`,
      'PLAN_LIMIT_EXCEEDED',
      userId,
      organizationId,
      { planType, limitType, currentCount, maxAllowed }
    )
  }

  getUserMessage(): string {
    const { planType, limitType, maxAllowed } = this.metadata || {}
    return `Plano ${planType} permite no máximo ${maxAllowed} ${limitType}.`
  }
}

/**
 * Database and system errors
 */
export class SystemError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    originalError?: Error,
    userId?: string,
    organizationId?: string,
    context?: string
  ) {
    super(
      message,
      code,
      userId,
      organizationId,
      { 
        originalError: originalError?.message,
        originalStack: originalError?.stack,
        context
      }
    )
  }

  getUserMessage(): string {
    return "Ocorreu um erro interno. Tente novamente em alguns instantes."
  }

  getSeverity(): 'high' | 'critical' {
    return this.code.includes('CRITICAL') ? 'critical' : 'high'
  }

  shouldAlert(): boolean {
    return true
  }
}

/**
 * Database connection error
 */
export class DatabaseError extends SystemError {
  constructor(
    operation: string,
    originalError: Error,
    userId?: string,
    organizationId?: string
  ) {
    super(
      `Database error during ${operation}: ${originalError.message}`,
      'DATABASE_ERROR',
      originalError,
      userId,
      organizationId,
      operation
    )
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends SystemError {
  constructor(
    service: string,
    operation: string,
    originalError: Error,
    userId?: string,
    organizationId?: string
  ) {
    super(
      `External service error (${service}) during ${operation}: ${originalError.message}`,
      'EXTERNAL_SERVICE_ERROR',
      originalError,
      userId,
      organizationId,
      `${service}:${operation}`
    )
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends SystemError {
  constructor(
    configKey: string,
    issue: string,
    userId?: string
  ) {
    super(
      `Configuration error for ${configKey}: ${issue}`,
      'CONFIGURATION_ERROR',
      undefined,
      userId,
      undefined,
      configKey
    )
  }

  getSeverity(): 'critical' {
    return 'critical'
  }
}

// Export all error types for easy importing


// Type guards for error checking
export function isOrganizationError(error: any): error is OrganizationError {
  return error instanceof OrganizationError
}

export function isSecurityError(error: any): error is SecurityError {
  return error instanceof SecurityError
}

export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError
}

export function isSystemError(error: any): error is SystemError {
  return error instanceof SystemError
}

// Re-export error handler and logger
export { errorHandler, ErrorHandler, type ErrorHandlingResult, type ErrorContext } from './error-handler'
export { errorLogger, ErrorLogger, type ErrorLogEntry, type ErrorLoggingContext } from './error-logger'

// Re-export Stripe-specific errors
export * from './stripe-errors'

// Re-export utility functions
export * from './utils'