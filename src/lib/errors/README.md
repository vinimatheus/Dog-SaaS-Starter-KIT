# Error Handling System

This directory contains a comprehensive error handling system for the organization security review project. The system provides structured error handling, detailed logging, and automated alerting for security and system issues.

## Overview

The error handling system consists of several key components:

1. **Error Hierarchy** (`index.ts`) - Custom error classes with structured metadata
2. **Error Handler** (`error-handler.ts`) - Centralized error processing and response generation
3. **Error Logger** (`error-logger.ts`) - Structured logging with context and alerting
4. **Utilities** (`utils.ts`) - Helper functions and wrappers for easy integration
5. **Examples** (`examples.ts`) - Usage examples and integration patterns

## Key Features

### 🔒 Security-First Design
- Automatic security violation logging
- Immediate alerting for critical security errors
- Permission denied tracking with context
- Rate limiting violation monitoring

### 📊 Structured Logging
- Comprehensive error context capture
- Performance metrics integration
- Request/response correlation
- Metadata preservation

### 🚨 Intelligent Alerting
- Severity-based alert routing
- Threshold-based alert suppression
- Cooldown periods to prevent spam
- Multiple alert channels (console, database, email, Slack)

### 🛡️ Type Safety
- Full TypeScript support
- Type guards for error checking
- Strongly typed error metadata
- Compile-time error prevention

## Error Types

### Base Classes

- `OrganizationError` - Base class for all organization-related errors
- `SecurityError` - Security and authorization errors
- `ValidationError` - Input validation errors
- `BusinessLogicError` - Business rule violations
- `SystemError` - System and infrastructure errors

### Specific Error Types

- `PermissionDeniedError` - Access permission violations
- `UnauthorizedAccessError` - Authentication failures
- `RateLimitExceededError` - Rate limiting violations
- `OrganizationNotFoundError` - Organization lookup failures
- `UserNotFoundError` - User lookup failures
- `InviteError` - Invite-related errors
- `DatabaseError` - Database operation failures
- `ExternalServiceError` - Third-party service failures

## Usage Examples

### Basic Server Action with Error Handling

```typescript
import { withErrorHandling, assertAuthenticated, assertOrganizationAccess } from '@/lib/errors'

export const updateOrganization = withErrorHandling(
  async (organizationId: string, name: string) => {
    const session = await auth()
    assertAuthenticated(session?.user?.id, 'organization_update', organizationId)
    
    const hasAccess = await securityValidator.validateOrganizationAccess(
      session.user.id,
      organizationId,
      Role.ADMIN
    )
    assertOrganizationAccess(hasAccess, session.user.id, 'update_organization', organizationId)
    
    // Update logic here
    return { success: true }
  },
  {
    action: 'update_organization',
    endpoint: 'server_action'
  }
)
```

### API Route with Error Handling

```typescript
import { withApiErrorHandling } from '@/lib/errors'

export const GET = withApiErrorHandling(
  async (request: Request) => {
    // API logic here
    return { data: [] }
  },
  {
    action: 'list_organizations',
    endpoint: '/api/organizations',
    method: 'GET'
  }
)
```

### Manual Error Handling

```typescript
import { 
  createPermissionDeniedError, 
  createValidationError,
  errorHandler 
} from '@/lib/errors'

export async function customAction(input: unknown) {
  try {
    // Validation
    if (!input) {
      throw createValidationError('Input is required', 'input')
    }
    
    // Permission check
    if (!hasPermission) {
      throw createPermissionDeniedError(userId, 'custom_action', organizationId)
    }
    
    // Business logic
    return { success: true }
    
  } catch (error) {
    const result = await errorHandler.handleError(error, {
      userId,
      action: 'custom_action'
    })
    
    return {
      success: false,
      error: result.error
    }
  }
}
```

## Error Context

The system automatically captures comprehensive context for each error:

- **User Context**: User ID, session information
- **Request Context**: HTTP method, endpoint, user agent, IP address
- **Business Context**: Organization ID, action being performed, resource accessed
- **Performance Context**: Operation duration, memory usage
- **Error Context**: Stack trace, metadata, severity level

## Alerting Configuration

Alerts are configured based on error severity and type:

### Critical Security Errors
- **Channels**: Console, Database, Email, Slack
- **Threshold**: 1 occurrence
- **Immediate**: Yes

### High Severity System Errors
- **Channels**: Console, Database, Email
- **Threshold**: 1 occurrence
- **Immediate**: Yes

### Medium Severity Errors
- **Channels**: Console, Database
- **Threshold**: 5 occurrences in 10 minutes
- **Cooldown**: 60 minutes

### Low Severity Errors
- **Channels**: Console only
- **No alerting**

## Integration with Existing Code

The error handling system is designed to integrate seamlessly with existing code:

1. **Wrapper Functions**: Use `withErrorHandling()` and `withApiErrorHandling()` for automatic error handling
2. **Assertion Functions**: Use `assertAuthenticated()`, `assertOrganizationAccess()`, etc. for common checks
3. **Error Factories**: Use `createPermissionDeniedError()`, `createValidationError()`, etc. for consistent error creation
4. **Manual Handling**: Use `errorHandler.handleError()` for custom error processing

## Monitoring and Maintenance

### Cleanup Tasks

The system includes automatic cleanup for:
- Alert history (24-hour retention)
- Rate limiting counters (configurable windows)
- Log entries (via audit logger retention policies)

### Performance Considerations

- In-memory rate limiting (consider Redis for production)
- Async logging to prevent blocking operations
- Configurable alert thresholds to prevent spam
- Efficient error categorization and routing

## Configuration

Environment variables for customization:

- `ERROR_LOG_FILE` - Enable file logging
- `EXTERNAL_LOGGING_ENABLED` - Enable external service logging
- `NODE_ENV` - Controls development vs production behavior

## Security Considerations

- User-safe error messages (no sensitive data exposure)
- Comprehensive audit trails for security events
- Immediate alerting for critical security violations
- Rate limiting to prevent abuse
- Input sanitization and validation

## Future Enhancements

- Integration with external monitoring services (DataDog, New Relic)
- Email and Slack alert implementations
- Redis-based rate limiting for production
- Error analytics and trending
- Automated error resolution suggestions