# Centralized Security Validation System

This directory contains the centralized security validation system for the organization management application. It provides comprehensive security features including access validation, input sanitization, rate limiting, and audit logging.

## Components

### 1. SecurityValidator (`security-validator.ts`)

The main validation class that provides:

- **Organization Access Validation**: Validates if users have permission to access specific organizations
- **Role-based Authorization**: Checks if users have required roles for specific actions
- **Input Sanitization**: Validates and sanitizes input data using Zod schemas
- **Business Logic Validation**: Validates organization unique IDs, invite emails, and plan limits

#### Key Methods:

```typescript
// Validate organization access
await securityValidator.validateOrganizationAccess(userId, organizationId, requiredRole?)

// Validate invite permissions
await securityValidator.validateInvitePermissions(userId, organizationId)

// Sanitize input data
const cleanData = securityValidator.sanitizeInput(rawData, schema)

// Validate organization unique ID availability
await securityValidator.validateOrganizationUniqueId(uniqueId, excludeId?)
```

### 2. Rate Limiter (`rate-limiter.ts`)

Provides rate limiting functionality to prevent abuse:

- **Action-based Limits**: Different limits for different actions
- **User-based Tracking**: Tracks limits per user
- **IP-based Limiting**: For actions like login attempts
- **Automatic Cleanup**: Removes expired entries

#### Configuration:

```typescript
const RATE_LIMITS = {
  'create-organization': { requests: 5, windowMs: 3600000 }, // 5 per hour
  'send-invite': { requests: 20, windowMs: 3600000 }, // 20 per hour
  'update-organization': { requests: 10, windowMs: 3600000 }, // 10 per hour
  // ... more limits
}
```

#### Usage:

```typescript
// Check rate limit
const result = await rateLimiter.checkRateLimit(userId, 'create-organization')
if (!result.allowed) {
  // Handle rate limit exceeded
}

// Enforce rate limit with helper
const enforcement = await enforceRateLimit(userId, 'send-invite')
if (!enforcement.success) {
  return { error: enforcement.error, retryAfter: enforcement.retryAfter }
}
```

### 3. Enhanced Schemas (`../schemas/security.ts`)

Comprehensive Zod schemas for input validation:

- **Email Validation**: Enhanced email validation with sanitization
- **Name Validation**: XSS protection and length limits
- **Organization Schemas**: Create/update organization validation
- **Invite Schemas**: Invite creation and management validation
- **Search Schemas**: SQL injection protection for search queries

#### Key Schemas:

```typescript
// Organization creation
const data = CreateOrganizationSchema.parse(input)

// User input validation
const user = CreateUserSchema.parse(userData)

// Invite validation
const invite = CreateInviteSchema.parse(inviteData)
```

### 4. Security Utilities (`index.ts`)

Common security utilities and error classes:

- **Custom Error Classes**: SecurityError, PermissionDeniedError, etc.
- **Security Headers**: Standard security headers for responses
- **Input Sanitization**: HTML and database sanitization functions
- **Validation Helpers**: Common validation functions

## Usage Examples

### Basic Organization Access Validation

```typescript
import { securityValidator } from '@/lib/security'

export async function getOrganization(uniqueId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  // Find organization
  const org = await prisma.organization.findUnique({
    where: { uniqueId }
  })

  if (!org) {
    redirect("/")
  }

  // Validate access
  const hasAccess = await securityValidator.validateOrganizationAccess(
    session.user.id,
    org.id
  )

  if (!hasAccess) {
    redirect("/")
  }

  return org
}
```

### Rate Limited Action

```typescript
import { enforceRateLimit, securityValidator } from '@/lib/security'

export async function createOrganization(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" }
  }

  // Check rate limit
  const rateLimitResult = await enforceRateLimit(session.user.id, 'create-organization')
  if (!rateLimitResult.success) {
    return {
      success: false,
      error: rateLimitResult.error,
      retryAfter: rateLimitResult.retryAfter
    }
  }

  // Validate and sanitize input
  const validatedData = securityValidator.sanitizeInput(
    { name: formData.get("name") },
    CreateOrganizationSchema
  )

  // Create organization...
}
```

### Comprehensive Invite Validation

```typescript
import { securityValidator, CreateInviteSchema } from '@/lib/security'

export async function inviteMember(email: string, role: Role, orgId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" }
  }

  // Validate input
  const validatedData = securityValidator.sanitizeInput(
    { email, role, organizationId: orgId },
    CreateInviteSchema
  )

  // Check permissions
  const canInvite = await securityValidator.validateInvitePermissions(
    session.user.id,
    orgId
  )

  if (!canInvite) {
    return { success: false, error: "Permission denied" }
  }

  // Validate email availability
  const emailValidation = await securityValidator.validateInviteEmail(
    validatedData.email,
    orgId
  )

  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.reason }
  }

  // Check plan limits
  const planValidation = await securityValidator.validateOrganizationPlanLimits(orgId)
  if (!planValidation.valid) {
    return { success: false, error: planValidation.reason }
  }

  // Create invite...
}
```

## Security Features

### 1. Access Control
- Role-based authorization (USER, ADMIN, OWNER)
- Organization membership validation
- Permission escalation prevention

### 2. Input Validation
- XSS protection
- SQL injection prevention
- Data sanitization
- Type validation with Zod

### 3. Rate Limiting
- Per-user action limits
- IP-based limits for sensitive actions
- Configurable time windows
- Automatic cleanup

### 4. Audit Logging
- Security event logging
- Failed access attempt tracking
- Action auditing
- Metadata collection

### 5. Error Handling
- Custom error classes
- Consistent error responses
- Security-aware error messages
- Audit trail for errors

## Configuration

### Rate Limits
Modify `RATE_LIMITS` in `rate-limiter.ts` to adjust limits:

```typescript
const RATE_LIMITS = {
  'your-action': { requests: 10, windowMs: 3600000 }, // 10 per hour
}
```

### Reserved Organization IDs
Update `RESERVED_ORGANIZATION_IDS` in `index.ts` to add more reserved words.

### Security Headers
Modify `createSecurityHeaders()` in `index.ts` to adjust security headers.

## Best Practices

1. **Always validate access** before performing organization operations
2. **Use rate limiting** for all user-initiated actions
3. **Sanitize all input** using the provided schemas
4. **Log security events** for audit trails
5. **Handle errors gracefully** without exposing sensitive information
6. **Use transactions** for critical operations
7. **Validate business logic** beyond just input validation

## Migration Guide

To integrate the security system into existing actions:

1. Import the security utilities:
   ```typescript
   import { securityValidator, enforceRateLimit } from '@/lib/security'
   ```

2. Add authentication checks:
   ```typescript
   const session = await auth()
   if (!session?.user?.id) {
     redirect("/auth/login")
   }
   ```

3. Add rate limiting:
   ```typescript
   const rateLimitResult = await enforceRateLimit(userId, 'action-name')
   if (!rateLimitResult.success) {
     return { success: false, error: rateLimitResult.error }
   }
   ```

4. Validate access permissions:
   ```typescript
   const hasAccess = await securityValidator.validateOrganizationAccess(
     userId, organizationId, requiredRole
   )
   if (!hasAccess) {
     return { success: false, error: "Permission denied" }
   }
   ```

5. Sanitize input:
   ```typescript
   const validatedData = securityValidator.sanitizeInput(rawData, schema)
   ```

6. Add audit logging:
   ```typescript
   await securityValidator.auditAction('action_name', userId, success, metadata)
   ```

## Testing

The security system includes comprehensive validation that should be tested:

- Access control with different user roles
- Rate limiting behavior
- Input validation edge cases
- Error handling scenarios
- Audit logging functionality

See `examples.ts` for complete implementation examples.