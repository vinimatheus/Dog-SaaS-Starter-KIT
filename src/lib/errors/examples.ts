// Examples of how to use the new error handling system
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import {
  withErrorHandling,
  withApiErrorHandling,
  assertAuthenticated,
  assertOrganizationAccess,
  assertResourceExists,
  validateInput,
  createPermissionDeniedError,
  createOrganizationNotFoundError,
  createValidationError,
  logAndThrow,
  ActionResult
} from "./utils"
import { securityValidator } from "@/lib/security/security-validator"
import { CreateOrganizationSchema } from "@/schemas/security"

/**
 * Example: Server action with comprehensive error handling
 */
export const exampleServerAction = withErrorHandling(
  async (organizationId: string, name: string): Promise<{ message: string }> => {
    // Get authenticated user
    const session = await auth()
    assertAuthenticated(session?.user?.id, 'organization_update', organizationId)
    
    const userId = session.user.id
    
    // Validate input
    const validatedInput = validateInput(
      { name },
      (input: any) => ({ name: input.name?.toString().trim() }),
      'name',
      userId,
      organizationId
    )
    
    // Check organization access
    const hasAccess = await securityValidator.validateOrganizationAccess(
      userId,
      organizationId,
      Role.ADMIN
    )
    assertOrganizationAccess(hasAccess, userId, 'update_organization', organizationId, Role.ADMIN)
    
    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })
    assertResourceExists(organization, 'organization', organizationId, userId)
    
    // Update organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: validatedInput.name }
    })
    
    return { message: 'Organization updated successfully' }
  },
  {
    action: 'update_organization',
    endpoint: 'server_action'
  }
)

/**
 * Example: API route with comprehensive error handling
 */
export const exampleApiHandler = withApiErrorHandling(
  async (request: Request): Promise<{ organizations: any[] }> => {
    // Get authenticated user
    const session = await auth()
    assertAuthenticated(session?.user?.id, 'organizations_list')
    
    const userId = session.user.id
    
    // Get user's organizations
    const organizations = await prisma.organization.findMany({
      where: {
        User_Organization: {
          some: {
            user_id: userId
          }
        }
      },
      select: {
        id: true,
        name: true,
        uniqueId: true,
        plan: true
      }
    })
    
    return { organizations }
  },
  {
    action: 'list_organizations',
    endpoint: '/api/organizations',
    method: 'GET'
  }
)

/**
 * Example: Manual error handling with logging
 */
export async function exampleManualErrorHandling(
  organizationId: string,
  inviteEmail: string
): Promise<ActionResult<{ inviteId: string }>> {
  try {
    // Get authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      throw createPermissionDeniedError(
        session?.user?.id || 'anonymous',
        'send_invite',
        organizationId
      )
    }
    
    const userId = session.user.id
    
    // Validate email format
    if (!inviteEmail || !inviteEmail.includes('@')) {
      throw createValidationError(
        'Invalid email format',
        'email',
        inviteEmail,
        userId,
        organizationId
      )
    }
    
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })
    
    if (!organization) {
      // Log and throw the error
      await logAndThrow(
        createOrganizationNotFoundError(organizationId, userId),
        {
          action: 'send_invite',
          feature: 'invite_management',
          userId,
          organizationId
        }
      )
    }
    
    // Check permissions
    const hasAccess = await securityValidator.validateInvitePermissions(userId, organizationId)
    if (!hasAccess) {
      throw createPermissionDeniedError(
        userId,
        'send_invite',
        organizationId,
        Role.ADMIN
      )
    }
    
    // Create invite (simplified)
    const invite = await prisma.invite.create({
      data: {
        email: inviteEmail,
        organization_id: organizationId,
        invited_by_id: userId,
        role: Role.USER,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    })
    
    return {
      success: true,
      data: { inviteId: invite.id }
    }
    
  } catch (error) {
    // Get session for error handling
    const session = await auth()
    
    // Handle any error that occurred
    const errorResult = await import('./error-handler').then(({ errorHandler }) =>
      errorHandler.handleError(error, {
        userId: session?.user?.id,
        organizationId,
        action: 'send_invite',
        endpoint: 'manual_example'
      })
    )
    
    return {
      success: false,
      error: errorResult.error
    }
  }
}

/**
 * Example: Using validation with Zod schema
 */
export async function exampleWithZodValidation(
  organizationData: unknown
): Promise<ActionResult<{ organizationId: string }>> {
  try {
    const session = await auth()
    assertAuthenticated(session?.user?.id, 'create_organization')
    
    const userId = session.user.id
    
    // Validate input with Zod schema
    const validatedData = validateInput(
      organizationData,
      (input) => CreateOrganizationSchema.parse(input),
      'organizationData',
      userId
    )
    
    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        uniqueId: validatedData.uniqueId || `org-${Date.now()}`,
        owner_user_id: userId,
        User_Organization: {
          create: {
            user_id: userId,
            role: Role.OWNER
          }
        }
      }
    })
    
    return {
      success: true,
      data: { organizationId: organization.id }
    }
    
  } catch (error) {
    // Get session for error handling
    const session = await auth()
    
    const errorResult = await import('./error-handler').then(({ errorHandler }) =>
      errorHandler.handleError(error, {
        userId: session?.user?.id,
        action: 'create_organization',
        endpoint: 'zod_validation_example'
      })
    )
    
    return {
      success: false,
      error: errorResult.error
    }
  }
}

/**
 * Example: Security error with immediate alerting
 */
export async function exampleSecurityViolation(
  organizationId: string,
  suspiciousAction: string
): Promise<void> {
  const session = await auth()
  const userId = session?.user?.id
  
  // Create and log security error
  const securityError = createPermissionDeniedError(
    userId || 'anonymous',
    suspiciousAction,
    organizationId
  )
  
  // This will trigger immediate alerting for security violations
  await logAndThrow(securityError, {
    action: suspiciousAction,
    feature: 'security_monitoring',
    userId,
    organizationId,
    additionalData: {
      suspiciousActivity: true,
      riskLevel: 'high'
    }
  })
}

/**
 * Example: Batch error handling
 */
export async function exampleBatchOperation(
  inviteEmails: string[],
  organizationId: string
): Promise<ActionResult<{ successful: number; failed: number; errors: any[] }>> {
  try {
    const session = await auth()
    assertAuthenticated(session?.user?.id, 'batch_invite', organizationId)
    
    const userId = session.user.id
    const results = { successful: 0, failed: 0, errors: [] as any[] }
    
    for (const email of inviteEmails) {
      try {
        // Validate each email
        validateInput(
          email,
          (input) => {
            if (typeof input !== 'string' || !input.includes('@')) {
              throw new Error('Invalid email format')
            }
            return input
          },
          'email',
          userId,
          organizationId
        )
        
        // Create invite (simplified)
        await prisma.invite.create({
          data: {
            email,
            organization_id: organizationId,
            invited_by_id: userId,
            role: Role.USER,
            status: 'PENDING',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        })
        
        results.successful++
        
      } catch (error) {
        results.failed++
        
        // Log individual error but continue processing
        const errorResult = await import('./error-handler').then(({ errorHandler }) =>
          errorHandler.handleError(error, {
            userId,
            organizationId,
            action: 'batch_invite_item',
            endpoint: 'batch_example'
          })
        )
        
        results.errors.push({
          email,
          error: errorResult.error
        })
      }
    }
    
    return {
      success: true,
      data: results
    }
    
  } catch (error) {
    // Get session for error handling
    const session = await auth()
    
    const errorResult = await import('./error-handler').then(({ errorHandler }) =>
      errorHandler.handleError(error, {
        userId: session?.user?.id,
        organizationId,
        action: 'batch_invite',
        endpoint: 'batch_example'
      })
    )
    
    return {
      success: false,
      error: errorResult.error
    }
  }
}