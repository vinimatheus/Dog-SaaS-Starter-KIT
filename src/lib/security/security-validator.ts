import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { logSecurityEvent } from "@/lib/security-logger"

// Enhanced validation schemas
export const OrganizationAccessSchema = z.object({
  userId: z.string().cuid("ID de usuário inválido"),
  organizationId: z.string().cuid("ID de organização inválido"),
  requiredRole: z.nativeEnum(Role).optional()
})

export const InviteActionSchema = z.object({
  email: z.string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .toLowerCase()
    .transform(email => email.trim()),
  role: z.nativeEnum(Role),
  organizationId: z.string().cuid("ID de organização inválido")
})

export const OrganizationInputSchema = z.object({
  name: z.string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .transform(name => name.trim())
    .refine(name => name.length > 0, "Nome não pode estar vazio"),
  uniqueId: z.string()
    .min(3, "ID único deve ter pelo menos 3 caracteres")
    .max(50, "ID único deve ter no máximo 50 caracteres")
    .regex(/^[a-z0-9-]+$/, "ID único deve conter apenas letras minúsculas, números e hífens")
    .transform(id => id.toLowerCase().trim())
})

export const UserInputSchema = z.object({
  name: z.string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .transform(name => name.trim()),
  email: z.string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .toLowerCase()
    .transform(email => email.trim())
})

// Rate limiting configuration
const RATE_LIMITS = {
  'create-organization': { requests: 5, windowMs: 3600000 }, // 5 per hour
  'send-invite': { requests: 20, windowMs: 3600000 }, // 20 per hour
  'update-organization': { requests: 10, windowMs: 3600000 }, // 10 per hour
  'accept-invite': { requests: 10, windowMs: 3600000 }, // 10 per hour
  'delete-invite': { requests: 30, windowMs: 3600000 }, // 30 per hour
  'resend-invite': { requests: 15, windowMs: 3600000 }, // 15 per hour
} as const

type RateLimitAction = keyof typeof RATE_LIMITS

// In-memory rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export class SecurityValidator {
  /**
   * Validates if a user has access to a specific organization
   */
  async validateOrganizationAccess(
    userId: string, 
    organizationId: string, 
    requiredRole?: Role
  ): Promise<boolean> {
    try {
      // Validate input parameters
      const validation = OrganizationAccessSchema.safeParse({
        userId,
        organizationId,
        requiredRole
      })

      if (!validation.success) {
        await logSecurityEvent("unauthorized_organization_access", {
          userId,
          metadata: { 
            organizationId, 
            error: "Invalid parameters",
            validationErrors: validation.error.errors
          }
        })
        return false
      }

      // Check if user is a member of the organization
      const userOrganization = await prisma.user_Organization.findUnique({
        where: {
          user_id_organization_id: {
            user_id: userId,
            organization_id: organizationId
          }
        },
        select: {
          role: true
        }
      })

      if (!userOrganization) {
        await logSecurityEvent("unauthorized_organization_access", {
          userId,
          metadata: { 
            organizationId, 
            error: "User not member of organization"
          }
        })
        return false
      }

      // Check role requirements if specified
      if (requiredRole) {
        const roleHierarchy = {
          [Role.USER]: 1,
          [Role.ADMIN]: 2,
          [Role.OWNER]: 3
        }

        const userRoleLevel = roleHierarchy[userOrganization.role]
        const requiredRoleLevel = roleHierarchy[requiredRole]

        if (userRoleLevel < requiredRoleLevel) {
          await logSecurityEvent("unauthorized_organization_access", {
            userId,
            metadata: { 
              organizationId, 
              error: "Insufficient role permissions",
              userRole: userOrganization.role,
              requiredRole
            }
          })
          return false
        }
      }

      return true
    } catch (error) {
      await logSecurityEvent("unauthorized_organization_access", {
        userId,
        metadata: { 
          organizationId, 
          error: "Validation error",
          errorMessage: error instanceof Error ? error.message : "Unknown error"
        }
      })
      return false
    }
  }

  /**
   * Validates if a user can send invites for an organization
   */
  async validateInvitePermissions(userId: string, organizationId: string): Promise<boolean> {
    return this.validateOrganizationAccess(userId, organizationId, Role.ADMIN)
  }

  /**
   * Validates if a user can manage members of an organization
   */
  async validateMemberManagementPermissions(userId: string, organizationId: string): Promise<boolean> {
    return this.validateOrganizationAccess(userId, organizationId, Role.ADMIN)
  }

  /**
   * Validates if a user can modify organization settings
   */
  async validateOrganizationModificationPermissions(userId: string, organizationId: string): Promise<boolean> {
    return this.validateOrganizationAccess(userId, organizationId, Role.OWNER)
  }

  /**
   * Sanitizes input data using Zod schemas
   */
  sanitizeInput<T>(input: unknown, schema: z.ZodSchema<T>): T {
    const result = schema.safeParse(input)
    
    if (!result.success) {
      throw new Error(`Input validation failed: ${result.error.errors.map(e => e.message).join(", ")}`)
    }
    
    return result.data
  }

  /**
   * Checks rate limiting for a user action
   */
  async checkRateLimit(userId: string, action: RateLimitAction): Promise<boolean> {
    const limit = RATE_LIMITS[action]
    if (!limit) {
      return true // No limit defined, allow action
    }

    const key = `${userId}:${action}`
    const now = Date.now()
    const stored = rateLimitStore.get(key)

    // Clean up expired entries
    if (stored && now > stored.resetTime) {
      rateLimitStore.delete(key)
    }

    const current = rateLimitStore.get(key)

    if (!current) {
      // First request in window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + limit.windowMs
      })
      return true
    }

    if (current.count >= limit.requests) {
      // Rate limit exceeded
      await logSecurityEvent("rate_limit_exceeded", {
        userId,
        metadata: { 
          action, 
          count: current.count, 
          limit: limit.requests,
          windowMs: limit.windowMs
        }
      })
      return false
    }

    // Increment counter
    current.count++
    rateLimitStore.set(key, current)
    return true
  }

  /**
   * Validates organization unique ID availability
   */
  async validateOrganizationUniqueId(uniqueId: string, excludeId?: string): Promise<boolean> {
    try {
      const existing = await prisma.organization.findUnique({
        where: { uniqueId },
        select: { id: true }
      })

      if (!existing) {
        return true // Available
      }

      // If excluding a specific ID (for updates), check if it's the same organization
      return excludeId ? existing.id === excludeId : false
    } catch (error) {
      return false
    }
  }

  /**
   * Validates if an email is already invited to an organization
   */
  async validateInviteEmail(email: string, organizationId: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Check if user is already a member
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true }
      })

      if (existingUser) {
        const existingMembership = await prisma.user_Organization.findUnique({
          where: {
            user_id_organization_id: {
              user_id: existingUser.id,
              organization_id: organizationId
            }
          }
        })

        if (existingMembership) {
          return { valid: false, reason: "Usuário já é membro desta organização" }
        }
      }

      // Check for pending invites
      const existingInvite = await prisma.invite.findUnique({
        where: {
          email_organization_id: {
            email,
            organization_id: organizationId
          }
        },
        select: { status: true, expires_at: true }
      })

      if (existingInvite && existingInvite.status === "PENDING" && existingInvite.expires_at > new Date()) {
        return { valid: false, reason: "Já existe um convite pendente para este email" }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, reason: "Erro ao validar email" }
    }
  }

  /**
   * Validates organization plan limits
   */
  async validateOrganizationPlanLimits(organizationId: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { 
          plan: true,
          _count: {
            select: {
              User_Organization: true,
              invites: {
                where: { status: "PENDING" }
              }
            }
          }
        }
      })

      if (!organization) {
        return { valid: false, reason: "Organização não encontrada" }
      }

      // Free plan limits
      if (organization.plan === "FREE") {
        const totalMembers = organization._count.User_Organization
        const pendingInvites = organization._count.invites

        if (totalMembers >= 5) {
          return { valid: false, reason: "Plano gratuito permite no máximo 5 membros" }
        }

        if (pendingInvites >= 10) {
          return { valid: false, reason: "Plano gratuito permite no máximo 10 convites pendentes" }
        }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, reason: "Erro ao validar limites do plano" }
    }
  }
}

// Export singleton instance
export const securityValidator = new SecurityValidator()