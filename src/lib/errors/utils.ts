// Utility functions for error handling integration
import { auth } from "@/auth"
import { headers } from "next/headers"
import { 
  OrganizationError,
  SecurityError,
  PermissionDeniedError,
  UnauthorizedAccessError,
  ValidationError,
  BusinessLogicError,
  OrganizationNotFoundError,
  UserNotFoundError,
  InviteNotFoundError,
  InviteAlreadyExistsError,
  InviteExpiredError,
  MemberAlreadyExistsError,
  PlanLimitExceededError,
  SystemError,
  DatabaseError
} from "./index"
import { errorHandler, ErrorContext } from "./error-handler"
import { errorLogger, ErrorLoggingContext } from "./error-logger"
import { Role } from "@prisma/client"

/**
 * Action result type for consistent API responses
 */
export type ActionResult<T = any> = {
  success: true
  data: T
} | {
  success: false
  error: {
    message: string
    code: string
    errorId?: string
  }
}

/**
 * Wrapper for server actions with comprehensive error handling
 */
export function withErrorHandling<T extends any[], R>(
  action: (...args: T) => Promise<R>,
  context?: Partial<ErrorContext>
): (...args: T) => Promise<ActionResult<R>> {
  return async (...args: T): Promise<ActionResult<R>> => {
    const startTime = Date.now()
    let userId: string | undefined
    
    try {
      // Get user context
      const session = await auth()
      userId = session?.user?.id
      
      // Execute the action
      const result = await action(...args)
      
      return {
        success: true,
        data: result
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      // Create error context
      const errorContext: ErrorContext = {
        userId,
        duration,
        ...context
      }
      
      // Handle the error
      const errorResult = await errorHandler.handleError(error, errorContext)
      
      return {
        success: false,
        error: errorResult.error
      }
    }
  }
}

/**
 * Wrapper for API routes with comprehensive error handling
 */
export function withApiErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  context?: Partial<ErrorContext>
): (...args: T) => Promise<Response> {
  return async (...args: T): Promise<Response> => {
    const startTime = Date.now()
    let userId: string | undefined
    
    try {
      // Get user context
      const session = await auth()
      userId = session?.user?.id
      
      // Get request context
      const headersList = await headers()
      const method = headersList.get('x-http-method') || 'GET'
      const userAgent = headersList.get('user-agent')
      const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip')
      
      // Execute the handler
      const result = await handler(...args)
      
      return Response.json({
        success: true,
        data: result
      })
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      // Create error context
      const errorContext: ErrorContext = {
        userId,
        duration,
        method: context?.method || 'API',
        ...context
      }
      
      // Handle the error
      const errorResult = await errorHandler.handleError(error, errorContext)
      
      return Response.json(
        {
          success: false,
          error: errorResult.error
        },
        { status: errorResult.statusCode }
      )
    }
  }
}

/**
 * Create permission denied error with context
 */
export function createPermissionDeniedError(
  userId: string,
  action: string,
  organizationId?: string,
  requiredRole?: Role,
  userRole?: Role
): PermissionDeniedError {
  return new PermissionDeniedError(userId, action, organizationId, requiredRole, userRole)
}

/**
 * Create unauthorized access error with context
 */
export function createUnauthorizedAccessError(
  userId: string | undefined,
  resource: string,
  organizationId?: string,
  attemptedAction?: string
): UnauthorizedAccessError {
  return new UnauthorizedAccessError(userId, resource, organizationId, attemptedAction)
}

/**
 * Create validation error with field context
 */
export function createValidationError(
  message: string,
  field?: string,
  value?: any,
  userId?: string,
  organizationId?: string
): ValidationError {
  return new ValidationError(message, field, value, userId, organizationId)
}

/**
 * Create organization not found error
 */
export function createOrganizationNotFoundError(
  organizationId: string,
  userId?: string
): OrganizationNotFoundError {
  return new OrganizationNotFoundError(organizationId, userId)
}

/**
 * Create user not found error
 */
export function createUserNotFoundError(
  userId: string,
  context?: string
): UserNotFoundError {
  return new UserNotFoundError(userId, context)
}

/**
 * Create invite not found error
 */
export function createInviteNotFoundError(
  inviteId: string,
  userId?: string
): InviteNotFoundError {
  return new InviteNotFoundError(inviteId, userId)
}

/**
 * Create invite already exists error
 */
export function createInviteAlreadyExistsError(
  email: string,
  organizationId: string,
  userId?: string
): InviteAlreadyExistsError {
  return new InviteAlreadyExistsError(email, organizationId, userId)
}

/**
 * Create invite expired error
 */
export function createInviteExpiredError(
  inviteId: string,
  userId?: string,
  organizationId?: string
): InviteExpiredError {
  return new InviteExpiredError(inviteId, userId, organizationId)
}

/**
 * Create member already exists error
 */
export function createMemberAlreadyExistsError(
  userId: string,
  organizationId: string
): MemberAlreadyExistsError {
  return new MemberAlreadyExistsError(userId, organizationId)
}

/**
 * Create plan limit exceeded error
 */
export function createPlanLimitExceededError(
  planType: string,
  limitType: string,
  currentCount: number,
  maxAllowed: number,
  organizationId: string,
  userId?: string
): PlanLimitExceededError {
  return new PlanLimitExceededError(
    planType,
    limitType,
    currentCount,
    maxAllowed,
    organizationId,
    userId
  )
}

/**
 * Create system error with context
 */
export function createSystemError(
  message: string,
  code: string,
  originalError?: Error,
  userId?: string,
  organizationId?: string,
  context?: string
): SystemError {
  return new SystemError(message, code, originalError, userId, organizationId, context)
}

/**
 * Create database error with context
 */
export function createDatabaseError(
  operation: string,
  originalError: Error,
  userId?: string,
  organizationId?: string
): DatabaseError {
  return new DatabaseError(operation, originalError, userId, organizationId)
}

/**
 * Log and throw error (for cases where you want to log before throwing)
 */
export async function logAndThrow(
  error: OrganizationError,
  context?: ErrorLoggingContext
): Promise<never> {
  await errorLogger.logError(error, context)
  throw error
}

/**
 * Assert condition or throw error
 */
export function assertOrThrow(
  condition: boolean,
  error: OrganizationError
): asserts condition {
  if (!condition) {
    throw error
  }
}

/**
 * Assert organization access or throw permission denied error
 */
export function assertOrganizationAccess(
  hasAccess: boolean,
  userId: string,
  action: string,
  organizationId?: string,
  requiredRole?: Role,
  userRole?: Role
): asserts hasAccess {
  if (!hasAccess) {
    throw createPermissionDeniedError(userId, action, organizationId, requiredRole, userRole)
  }
}

/**
 * Assert user authentication or throw unauthorized error
 */
export function assertAuthenticated(
  userId: string | undefined,
  resource: string,
  organizationId?: string
): asserts userId is string {
  if (!userId) {
    throw createUnauthorizedAccessError(userId, resource, organizationId, 'access')
  }
}

/**
 * Assert resource exists or throw not found error
 */
export function assertResourceExists<T>(
  resource: T | null | undefined,
  resourceType: string,
  resourceId: string,
  userId?: string
): asserts resource is T {
  if (!resource) {
    switch (resourceType) {
      case 'organization':
        throw createOrganizationNotFoundError(resourceId, userId)
      case 'user':
        throw createUserNotFoundError(resourceId)
      case 'invite':
        throw createInviteNotFoundError(resourceId, userId)
      default:
        throw new BusinessLogicError(
          `${resourceType} not found: ${resourceId}`,
          `${resourceType.toUpperCase()}_NOT_FOUND`,
          userId
        )
    }
  }
}

/**
 * Validate and sanitize input or throw validation error
 */
export function validateInput<T>(
  input: unknown,
  validator: (input: unknown) => T,
  fieldName?: string,
  userId?: string,
  organizationId?: string
): T {
  try {
    return validator(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid input'
    throw createValidationError(message, fieldName, input, userId, organizationId)
  }
}

/**
 * Execute with timeout or throw system error
 */
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string,
  userId?: string,
  organizationId?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(createSystemError(
        `Operation timeout: ${operationName} exceeded ${timeoutMs}ms`,
        'OPERATION_TIMEOUT',
        undefined,
        userId,
        organizationId,
        operationName
      ))
    }, timeoutMs)
  })
  
  return Promise.race([operation(), timeoutPromise])
}

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  operationName: string = 'operation',
  userId?: string,
  organizationId?: string
): Promise<T> {
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries) {
        break
      }
      
      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw createSystemError(
    `Operation failed after ${maxRetries} attempts: ${operationName}`,
    'OPERATION_FAILED_AFTER_RETRIES',
    lastError,
    userId,
    organizationId,
    operationName
  )
}

/**
 * Safe async operation that logs errors but doesn't throw
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  context?: ErrorLoggingContext
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof OrganizationError) {
      await errorLogger.logError(error, context)
    } else {
      const systemError = createSystemError(
        error instanceof Error ? error.message : String(error),
        'SAFE_ASYNC_ERROR',
        error instanceof Error ? error : undefined,
        context?.userId,
        context?.organizationId,
        'safe_async_operation'
      )
      await errorLogger.logError(systemError, context)
    }
    
    return fallbackValue
  }
}

/**
 * Get error context from current request
 */
export async function getCurrentErrorContext(
  additionalContext?: Partial<ErrorContext>
): Promise<ErrorContext> {
  try {
    const session = await auth()
    const headersList = await headers()
    
    return {
      userId: session?.user?.id,
      method: headersList.get('x-http-method') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
      ip: headersList.get('x-forwarded-for') || 
          headersList.get('x-real-ip') || undefined,
      ...additionalContext
    }
  } catch (error) {
    return additionalContext || {}
  }
}