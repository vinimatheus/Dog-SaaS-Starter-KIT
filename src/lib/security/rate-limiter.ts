import { logSecurityEvent } from "@/lib/security-logger"

// Rate limiting configuration
export const RATE_LIMITS = {
  'create-organization': { requests: 5, windowMs: 3600000 }, // 5 per hour
  'send-invite': { requests: 20, windowMs: 3600000 }, // 20 per hour
  'update-organization': { requests: 10, windowMs: 3600000 }, // 10 per hour
  'accept-invite': { requests: 10, windowMs: 3600000 }, // 10 per hour
  'delete-invite': { requests: 30, windowMs: 3600000 }, // 30 per hour
  'resend-invite': { requests: 15, windowMs: 3600000 }, // 15 per hour
  'remove-member': { requests: 20, windowMs: 3600000 }, // 20 per hour
  'update-member-role': { requests: 15, windowMs: 3600000 }, // 15 per hour
  'login-attempt': { requests: 10, windowMs: 900000 }, // 10 per 15 minutes
  'password-reset': { requests: 3, windowMs: 3600000 }, // 3 per hour
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS

interface RateLimitEntry {
  count: number
  resetTime: number
  firstAttempt: number
}

// In-memory rate limiting store (in production, use Redis)
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key)
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key)
      return undefined
    }
    return entry
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  size(): number {
    return this.store.size
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

const rateLimitStore = new RateLimitStore()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

export class RateLimiter {
  /**
   * Check if an action is allowed for a user
   */
  async checkRateLimit(
    userId: string, 
    action: RateLimitAction,
    customKey?: string
  ): Promise<RateLimitResult> {
    const limit = RATE_LIMITS[action]
    if (!limit) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: Date.now() + 3600000 // 1 hour default
      }
    }

    const key = customKey || `${userId}:${action}`
    const now = Date.now()
    const entry = rateLimitStore.get(key)

    if (!entry) {
      // First request in window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + limit.windowMs,
        firstAttempt: now
      }
      rateLimitStore.set(key, newEntry)

      return {
        allowed: true,
        remaining: limit.requests - 1,
        resetTime: newEntry.resetTime
      }
    }

    if (entry.count >= limit.requests) {
      // Rate limit exceeded
      await logSecurityEvent("rate_limit_exceeded", {
        userId,
        metadata: { 
          action, 
          count: entry.count, 
          limit: limit.requests,
          windowMs: limit.windowMs,
          firstAttempt: entry.firstAttempt,
          duration: now - entry.firstAttempt
        }
      })

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      }
    }

    // Increment counter
    entry.count++
    rateLimitStore.set(key, entry)

    return {
      allowed: true,
      remaining: limit.requests - entry.count,
      resetTime: entry.resetTime
    }
  }

  /**
   * Check rate limit for IP-based actions (like login attempts)
   */
  async checkIPRateLimit(
    ip: string, 
    action: RateLimitAction
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`ip:${ip}`, action, `ip:${ip}:${action}`)
  }

  /**
   * Reset rate limit for a specific user and action
   */
  async resetRateLimit(userId: string, action: RateLimitAction): Promise<void> {
    const key = `${userId}:${action}`
    rateLimitStore.delete(key)
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    userId: string, 
    action: RateLimitAction
  ): Promise<RateLimitResult> {
    const limit = RATE_LIMITS[action]
    if (!limit) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: Date.now() + 3600000
      }
    }

    const key = `${userId}:${action}`
    const entry = rateLimitStore.get(key)

    if (!entry) {
      return {
        allowed: true,
        remaining: limit.requests,
        resetTime: Date.now() + limit.windowMs
      }
    }

    return {
      allowed: entry.count < limit.requests,
      remaining: Math.max(0, limit.requests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: entry.count >= limit.requests ? 
        Math.ceil((entry.resetTime - Date.now()) / 1000) : undefined
    }
  }

  /**
   * Get rate limit statistics
   */
  getStats(): {
    totalEntries: number
    actions: Record<RateLimitAction, { requests: number; windowMs: number }>
  } {
    return {
      totalEntries: rateLimitStore.size(),
      actions: RATE_LIMITS
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()

// Utility function for middleware usage
export async function enforceRateLimit(
  userId: string,
  action: RateLimitAction,
  customKey?: string
): Promise<{ success: boolean; error?: string; retryAfter?: number }> {
  const result = await rateLimiter.checkRateLimit(userId, action, customKey)
  
  if (!result.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded for ${action}. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter
    }
  }

  return { success: true }
}