/**
 * Example usage of the centralized security validation system
 * This file demonstrates how to integrate the SecurityValidator in actions
 */

import { auth } from "@/auth"
import { securityValidator, enforceRateLimit, CreateOrganizationSchema } from "@/lib/security"
import { InviteActionSchema } from "@/lib/security/security-validator"
import { logSecurityEvent } from "@/lib/security-logger"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

/**
 * Example: Secure organization creation with validation and rate limiting
 */
export async function createOrganizationSecure(formData: FormData) {
  try {
    // 1. Authentication check
    const session = await auth()
    if (!session?.user?.id) {
      redirect("/auth/login")
    }

    const userId = session.user.id

    // 2. Rate limiting check
    const rateLimitResult = await enforceRateLimit(userId, 'create-organization')
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: rateLimitResult.error,
        retryAfter: rateLimitResult.retryAfter
      }
    }

    // 3. Input validation and sanitization
    const rawData = {
      name: formData.get("name"),
      uniqueId: formData.get("uniqueId")
    }

    const validatedData = securityValidator.sanitizeInput(rawData, CreateOrganizationSchema)

    // 4. Business logic validation
    if (validatedData.uniqueId) {
      const isUniqueIdAvailable = await securityValidator.validateOrganizationUniqueId(validatedData.uniqueId)
      if (!isUniqueIdAvailable) {
        return {
          success: false,
          error: "ID único já está em uso"
        }
      }
    }

    // 5. Create organization with validated data
    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        uniqueId: validatedData.uniqueId || generateUniqueId(validatedData.name),
        owner_user_id: userId
      }
    })

    // 6. Audit logging
    await logSecurityEvent('organization_creation', {
      userId,
      metadata: { 
        organizationId: organization.id, 
        name: organization.name,
        action: 'createOrganization'
      }
    })

    return {
      success: true,
      organization
    }

  } catch (error) {
    // Error handling with audit logging
    const errorSession = await auth()
    await logSecurityEvent('unauthorized_organization_creation', {
      userId: errorSession?.user?.id,
      metadata: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'createOrganization'
      }
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao criar organização"
    }
  }
}

/**
 * Example: Secure organization access validation
 */
export async function getOrganizationSecure(uniqueId: string) {
  try {
    // 1. Authentication check
    const session = await auth()
    if (!session?.user?.id) {
      redirect("/auth/login")
    }

    const userId = session.user.id

    // 2. Find organization
    const organization = await prisma.organization.findUnique({
      where: { uniqueId },
      select: { id: true, name: true, uniqueId: true }
    })

    if (!organization) {
      redirect("/")
    }

    // 3. Validate access permissions
    const hasAccess = await securityValidator.validateOrganizationAccess(
      userId,
      organization.id
    )

    if (!hasAccess) {
      redirect("/")
    }

    // 4. Return organization data
    return organization

  } catch (error) {
    // Audit failed access attempts
    const errorSession = await auth()
    await logSecurityEvent('unauthorized_organization_access', {
      userId: errorSession?.user?.id,
      metadata: { 
        uniqueId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'getOrganizationSecure'
      }
    })

    redirect("/")
  }
}

/**
 * Example: Secure invite creation with comprehensive validation
 */
export async function createInviteSecure(
  email: string,
  role: string,
  organizationId: string
) {
  try {
    // 1. Authentication check
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Não autorizado" }
    }

    const userId = session.user.id

    // 2. Rate limiting
    const rateLimitResult = await enforceRateLimit(userId, 'send-invite')
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: rateLimitResult.error,
        retryAfter: rateLimitResult.retryAfter
      }
    }

    // 3. Input validation
    const validatedData = securityValidator.sanitizeInput(
      { email, role, organizationId },
      InviteActionSchema
    )

    // 4. Permission validation
    const canInvite = await securityValidator.validateInvitePermissions(
      userId,
      organizationId
    )

    if (!canInvite) {
      return { success: false, error: "Você não tem permissão para enviar convites" }
    }

    // 5. Business logic validation
    const emailValidation = await securityValidator.validateInviteEmail(
      validatedData.email,
      organizationId
    )

    if (!emailValidation.valid) {
      return { success: false, error: emailValidation.reason }
    }

    const planValidation = await securityValidator.validateOrganizationPlanLimits(organizationId)
    if (!planValidation.valid) {
      return { success: false, error: planValidation.reason }
    }

    // 6. Create invite
    const invite = await prisma.invite.create({
      data: {
        email: validatedData.email,
        role: validatedData.role,
        organization_id: organizationId,
        invited_by_id: userId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    })

    // 7. Audit logging
    await logSecurityEvent('invite_sent', {
      userId,
      metadata: { 
        inviteId: invite.id,
        email: validatedData.email,
        role: validatedData.role,
        organizationId,
        action: 'inviteMemberSecure'
      }
    })

    return { success: true, invite }

  } catch (error) {
    // Error handling with audit
    const errorSession = await auth()
    await logSecurityEvent('unauthorized_organization_access', {
      userId: errorSession?.user?.id,
      metadata: { 
        email,
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'inviteMemberSecure'
      }
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao criar convite"
    }
  }
}

// Helper function for generating unique IDs
function generateUniqueId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) + '-' + Math.random().toString(36).substr(2, 6)
}