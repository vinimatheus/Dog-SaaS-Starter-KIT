// Re-export all security utilities for easy importing
export { SecurityValidator, securityValidator } from './security-validator'
export { RateLimiter, rateLimiter, enforceRateLimit, RATE_LIMITS } from './rate-limiter'
export type { RateLimitAction, RateLimitResult } from './rate-limiter'

// Re-export monitoring and alerting components
export { SecurityMetrics, securityMetrics, recordOperationDuration, incrementSecurityCounter } from './security-metrics'
export type { SecurityMetric, SecurityMetricType, MetricTimeWindow } from './security-metrics'
export { SecurityAlerts, securityAlerts, checkSecurityThresholds, triggerCustomAlert } from './security-alerts'
export type { AlertSeverity, AlertType, SecurityAlert, AlertThreshold } from './security-alerts'
export { SecurityMonitoringService, securityMonitoringService, startSecurityMonitoring, stopSecurityMonitoring, getSecurityMonitoringStatus } from './monitoring-service'

// Re-export security schemas
export * from '@/schemas/security'

// Re-export security logger
export { logSecurityEvent } from '@/lib/security-logger'

// Common security utilities
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public userId?: string,
    public organizationId?: string
  ) {
    super(message)
    this.name = 'SecurityError'
  }
}

export class PermissionDeniedError extends SecurityError {
  constructor(userId: string, action: string, organizationId?: string) {
    super(
      `Permission denied for action: ${action}`,
      'PERMISSION_DENIED',
      userId,
      organizationId
    )
  }
}

export class RateLimitExceededError extends SecurityError {
  constructor(userId: string, action: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for action: ${action}${retryAfter ? `. Retry after ${retryAfter} seconds` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      userId
    )
  }
}

export class ValidationError extends SecurityError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR')
    if (field) {
      this.message = `${field}: ${message}`
    }
  }
}

// Security middleware helpers
export function createSecurityHeaders() {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(process.env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    })
  }
}

// Input sanitization utilities
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function sanitizeForDatabase(input: string): string {
  // Remove potential SQL injection patterns
  return input
    .replace(/[';-]/g, '')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi, '')
    .trim()
}

// Validation helpers
export function isValidCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/.test(id)
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email) && email.length <= 255
}

export function isValidOrganizationId(uniqueId: string): boolean {
  return /^[a-z0-9-]{3,50}$/.test(uniqueId)
}

// Security constants
export const RESERVED_ORGANIZATION_IDS = new Set([
  'api', 'www', 'admin', 'root', 'system', 'support', 'help',
  'mail', 'email', 'ftp', 'blog', 'shop', 'store', 'app',
  'mobile', 'web', 'secure', 'ssl', 'cdn', 'static', 'assets',
  'auth', 'login', 'register', 'signup', 'signin', 'logout',
  'dashboard', 'panel', 'control', 'manage', 'config', 'settings',
  'organizations', 'invite', 'onboarding'
])

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FILE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif',
  'application/pdf',
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
])

// Audit logging helpers
export async function auditAction(
  action: string,
  userId: string,
  success: boolean,
  metadata?: Record<string, any>
) {
  const { logSecurityEvent } = await import('@/lib/security-logger')
  await logSecurityEvent(action as any, {
    userId,
    metadata: {
      success,
      timestamp: new Date().toISOString(),
      ...metadata
    }
  })
}