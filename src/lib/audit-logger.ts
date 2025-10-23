import { headers } from "next/headers"
import { prisma } from "./prisma"
import { PlanType, Role, InviteStatus } from "@prisma/client"

// Enhanced event types for comprehensive audit logging
export type AuditEventType = 
  // Authentication & Authorization
  | "unauthorized_organization_creation"
  | "unauthorized_profile_update"
  | "unauthorized_checkout_redirect"
  | "unauthorized_organization_access"
  | "permission_denied"
  | "authentication_failed"
  | "session_expired"
  
  // Organization Events
  | "organization_access"
  | "organization_creation"
  | "organization_update"
  | "organization_deletion"
  | "organization_ownership_transfer"
  
  // Member Management
  | "member_added"
  | "member_removed"
  | "member_role_changed"
  | "member_permissions_updated"
  
  // Invite Events
  | "invite_sent"
  | "invite_accepted"
  | "invite_rejected"
  | "invite_expired"
  | "invite_resent"
  | "invite_deleted"
  
  // Security Events
  | "rate_limit_exceeded"
  | "suspicious_activity_detected"
  | "data_validation_failed"
  | "security_violation"
  
  // System Events
  | "checkout_redirect"
  | "profile_update"
  | "system_error"

export type AuditEventMetadata = {
  // Organization context
  organizationId?: string
  organizationName?: string
  organizationUniqueId?: string
  
  // User context
  targetUserId?: string
  targetUserEmail?: string
  userRole?: Role
  requiredRole?: Role
  
  // Invite context
  inviteId?: string
  inviteEmail?: string
  inviteRole?: Role
  inviteStatus?: InviteStatus
  
  // Action context
  action?: string
  resource?: string
  method?: string
  endpoint?: string
  
  // Error context
  error?: string
  errorCode?: string
  errorMessage?: string
  validationErrors?: any[]
  
  // Security context
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  
  // Rate limiting context
  count?: number
  limit?: number
  windowMs?: number
  firstAttempt?: number
  
  // Performance context
  duration?: number
  
  // Business context
  plan?: PlanType
  name?: string
  
  // Additional metadata
  [key: string]: any
}

export type AuditEventData = {
  userId?: string
  ip?: string | null
  userAgent?: string | null
  metadata?: AuditEventMetadata
}

/**
 * Centralized audit logger for security and business events
 * Provides structured logging with consistent metadata and context
 */
export class AuditLogger {
  private static instance: AuditLogger
  
  private constructor() {}
  
  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }
  
  /**
   * Log a security or audit event with structured metadata
   */
  async logEvent(
    eventType: AuditEventType,
    data: AuditEventData
  ): Promise<void> {
    try {
      const headersList = await headers()
      const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip")
      const userAgent = headersList.get("user-agent")
      
      await prisma.securityLog.create({
        data: {
          eventType,
          userId: data.userId,
          ip: ip || data.ip,
          userAgent: userAgent || data.userAgent,
          metadata: data.metadata || {},
        },
      })
    } catch (error) {
      // Log to console as fallback if database logging fails
      console.error(`[AuditLogger] Failed to log event ${eventType}:`, error)
      console.error(`[AuditLogger] Event data:`, { eventType, ...data })
    }
  }
  
  /**
   * Log organization access events
   */
  async logOrganizationAccess(
    userId: string,
    organizationId: string,
    action: string,
    success: boolean,
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    const eventType: AuditEventType = success ? "organization_access" : "unauthorized_organization_access"
    
    await this.logEvent(eventType, {
      userId,
      metadata: {
        organizationId,
        action,
        success,
        ...additionalMetadata
      }
    })
  }
  
  /**
   * Log organization management events (create, update, delete)
   */
  async logOrganizationManagement(
    eventType: "organization_creation" | "organization_update" | "organization_deletion",
    userId: string,
    organizationId: string,
    organizationName?: string,
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    await this.logEvent(eventType, {
      userId,
      metadata: {
        organizationId,
        organizationName,
        action: eventType,
        ...additionalMetadata
      }
    })
  }
  
  /**
   * Log invite-related events
   */
  async logInviteAction(
    eventType: "invite_sent" | "invite_accepted" | "invite_rejected" | "invite_expired" | "invite_resent" | "invite_deleted",
    userId: string,
    inviteId: string,
    organizationId: string,
    inviteEmail?: string,
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    await this.logEvent(eventType, {
      userId,
      metadata: {
        inviteId,
        organizationId,
        inviteEmail,
        action: eventType,
        ...additionalMetadata
      }
    })
  }
  
  /**
   * Log member management events
   */
  async logMemberManagement(
    eventType: "member_added" | "member_removed" | "member_role_changed",
    userId: string,
    organizationId: string,
    targetUserId: string,
    targetUserEmail?: string,
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    await this.logEvent(eventType, {
      userId,
      metadata: {
        organizationId,
        targetUserId,
        targetUserEmail,
        action: eventType,
        ...additionalMetadata
      }
    })
  }
  
  /**
   * Log security violations and unauthorized access attempts
   */
  async logSecurityViolation(
    userId: string | undefined,
    violation: string,
    context: Partial<AuditEventMetadata>
  ): Promise<void> {
    await this.logEvent("security_violation", {
      userId,
      metadata: {
        error: violation,
        ...context
      }
    })
  }
  
  /**
   * Log permission denied events
   */
  async logPermissionDenied(
    userId: string,
    action: string,
    resource: string,
    requiredRole?: Role,
    userRole?: Role,
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    await this.logEvent("permission_denied", {
      userId,
      metadata: {
        action,
        resource,
        requiredRole,
        userRole,
        error: `Permission denied for action: ${action} on resource: ${resource}`,
        ...additionalMetadata
      }
    })
  }
  
  /**
   * Log rate limiting events
   */
  async logRateLimitExceeded(
    userId: string | undefined,
    action: string,
    count: number,
    limit: number,
    windowMs: number,
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    await this.logEvent("rate_limit_exceeded", {
      userId,
      metadata: {
        action,
        count,
        limit,
        windowMs,
        error: `Rate limit exceeded for action: ${action}`,
        ...additionalMetadata
      }
    })
  }
  
  /**
   * Log data validation failures
   */
  async logValidationFailure(
    userId: string | undefined,
    action: string,
    validationErrors: any[],
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    await this.logEvent("data_validation_failed", {
      userId,
      metadata: {
        action,
        validationErrors,
        error: "Data validation failed",
        ...additionalMetadata
      }
    })
  }
  
  /**
   * Log system errors with context
   */
  async logSystemError(
    userId: string | undefined,
    error: Error | string,
    context: string,
    additionalMetadata?: Partial<AuditEventMetadata>
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined
    
    await this.logEvent("system_error", {
      userId,
      metadata: {
        error: errorMessage,
        errorStack,
        context,
        ...additionalMetadata
      }
    })
  }
}

// Export singleton instance for easy access
export const auditLogger = AuditLogger.getInstance()

// Backward compatibility - maintain existing function for gradual migration
export async function logSecurityEvent(
  eventType: AuditEventType,
  data: AuditEventData
): Promise<void> {
  await auditLogger.logEvent(eventType, data)
}