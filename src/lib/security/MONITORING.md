# Security Monitoring System

This document describes the comprehensive security monitoring and alerting system implemented for the organization management platform.

## Overview

The security monitoring system provides real-time monitoring of security events, automatic alerting based on configurable thresholds, and comprehensive metrics collection for security analysis.

## Components

### 1. SecurityMetrics (`security-metrics.ts`)

Collects and analyzes security-related metrics:

- **Access denied attempts** - Tracks unauthorized access attempts
- **Rate limit violations** - Monitors API abuse patterns
- **Organization access patterns** - Analyzes access to organizations
- **Invite operations** - Tracks invite sending, acceptance, and rejection
- **Security violations** - Monitors policy violations and suspicious activity
- **Performance metrics** - Tracks operation durations and system health

#### Key Methods:

- `recordMetric()` - Record a security metric
- `getAccessDeniedCount()` - Get access denied count for time window
- `getSecurityDashboard()` - Get comprehensive dashboard data
- `getRealtimeMetrics()` - Get cached real-time metrics

### 2. SecurityAlerts (`security-alerts.ts`)

Manages security alerts and notifications:

- **Alert creation** - Creates alerts based on thresholds or patterns
- **Alert resolution** - Allows manual resolution of alerts
- **Notification system** - Sends notifications for critical alerts
- **Alert filtering** - Filter alerts by type, severity, or status

#### Alert Types:

- `excessive_access_denied` - Too many access denied attempts
- `rate_limit_abuse` - Rate limiting violations
- `suspicious_user_activity` - Unusual user behavior patterns
- `multiple_security_violations` - Multiple security policy violations
- `unusual_invite_patterns` - Abnormal invite activity
- `performance_degradation` - System performance issues

#### Alert Severities:

- **CRITICAL** - Immediate security threats requiring action
- **HIGH** - Significant security events needing attention
- **MEDIUM** - Notable security patterns to monitor
- **LOW** - Informational security events

### 3. SecurityMonitoringService (`monitoring-service.ts`)

Orchestrates continuous monitoring:

- **Background monitoring** - Runs continuous security checks
- **Threshold checking** - Automatically triggers alerts
- **Cleanup operations** - Removes old data and resolved alerts
- **Service management** - Start/stop monitoring service

#### Key Methods:

- `start()` - Start monitoring service
- `stop()` - Stop monitoring service
- `getStatus()` - Get service status
- `forceMetricsCollection()` - Manually trigger metrics collection

### 4. Auto-Start Monitoring (`auto-start-monitoring.ts`)

Automatically initializes monitoring when the application starts:

- **Production auto-start** - Automatically starts in production
- **Graceful shutdown** - Handles service shutdown
- **Error handling** - Prevents app crashes if monitoring fails

## API Endpoints

### Security Dashboard API (`/api/admin/security-dashboard`)

**GET** - Retrieve security dashboard data:

- Query parameters: `timeWindow`, `organizationId`
- Returns comprehensive security metrics and active alerts
- Requires admin permissions

**PATCH** - Update alert status:

- Body: `{ alertId, action }`
- Actions: `resolve`
- Requires admin permissions

## Integration Points

### Actions Integration

Security monitoring is integrated into key actions:

- **Organization access** (`organization.actions.ts`) - Records access metrics
- **Invite operations** (`invite-member.actions.ts`) - Tracks invite metrics
- **Permission checks** - Logs denied access attempts
- **Rate limiting** - Records rate limit violations

### Automatic Metrics Collection

The system automatically records metrics for:

- User authentication events
- Organization access attempts
- Permission validation failures
- Rate limiting violations
- Data validation errors
- System performance metrics

## Configuration

### Default Thresholds

```typescript
const DEFAULT_THRESHOLDS = [
  {
    type: "excessive_access_denied",
    threshold: 10,
    timeWindow: "15m",
    severity: "HIGH",
  },
  {
    type: "rate_limit_abuse",
    threshold: 5,
    timeWindow: "5m",
    severity: "MEDIUM",
  },
  {
    type: "multiple_security_violations",
    threshold: 3,
    timeWindow: "1h",
    severity: "CRITICAL",
  },
];
```

### Environment Variables

- `SECURITY_MONITORING_AUTO_START` - Enable auto-start in development
- `NODE_ENV=production` - Automatically enables monitoring

## Usage

### Starting Monitoring Service

```bash
# Manual start
npm run security:monitor

# Or programmatically
import { startSecurityMonitoring } from '@/lib/security'
await startSecurityMonitoring({
  monitoringIntervalMs: 60000,
  enableAlerts: true
})
```

### Recording Custom Metrics

```typescript
import {
  incrementSecurityCounter,
  recordOperationDuration,
} from "@/lib/security";

// Record a security event
await incrementSecurityCounter("access_denied_count", {
  userId: "user123",
  reason: "permission_denied",
});

// Record operation performance
const startTime = Date.now();
// ... perform operation
await recordOperationDuration("myOperation", startTime, {
  success: true,
  userId: "user123",
});
```

### Creating Custom Alerts

```typescript
import { triggerCustomAlert } from "@/lib/security";

await triggerCustomAlert(
  "suspicious_user_activity",
  "HIGH",
  "Suspicious Activity Detected",
  "User performed unusual actions",
  { userId: "user123", actions: ["action1", "action2"] }
);
```

### Accessing Dashboard Data

```typescript
import { securityMetrics } from "@/lib/security";

// Get comprehensive dashboard
const dashboard = await securityMetrics.getSecurityDashboard("24h");

// Get specific metrics
const accessDenied = await securityMetrics.getAccessDeniedCount("1h");
const violations = await securityMetrics.getSecurityViolations("24h");
```

## Admin Dashboard

The security dashboard is available at `/admin/security` for users with admin permissions.

Features:

- Real-time security metrics
- Active alerts management
- Time window filtering
- Alert resolution
- System health monitoring

## Testing

Run security monitoring tests:

```bash
npm run test:security
```

The test suite covers:

- Metrics collection and retrieval
- Alert creation and resolution
- Service lifecycle management
- Integration scenarios
- Error handling

## Monitoring Best Practices

1. **Regular Review** - Review security alerts and metrics regularly
2. **Threshold Tuning** - Adjust alert thresholds based on normal usage patterns
3. **Response Procedures** - Establish procedures for responding to different alert types
4. **Data Retention** - Configure appropriate data retention policies
5. **Performance Impact** - Monitor the performance impact of the monitoring system

## Troubleshooting

### Service Not Starting

- Check environment variables
- Verify database connectivity
- Review application logs

### Missing Metrics

- Ensure actions are properly integrated
- Check for database connection issues
- Verify metric recording calls

### False Alerts

- Review and adjust alert thresholds
- Analyze normal usage patterns
- Consider time-based threshold variations

## Future Enhancements

- Integration with external monitoring systems (PagerDuty, Slack)
- Machine learning-based anomaly detection
- Advanced visualization and reporting
- Automated response actions
- Custom alert rules configuration UI
