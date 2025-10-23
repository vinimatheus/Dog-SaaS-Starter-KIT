import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { securityMetrics, securityAlerts, securityMonitoringService } from '@/lib/security'

// Mock the database
vi.mock('@/lib/prisma', () => ({
  prisma: {
    securityLog: {
      count: vi.fn().mockResolvedValue(5),
      findMany: vi.fn().mockResolvedValue([
        {
          id: '1',
          eventType: 'unauthorized_organization_access',
          userId: 'user1',
          metadata: { organizationId: 'org1' },
          createdAt: new Date()
        }
      ])
    },
    user_Organization: {
      findMany: vi.fn().mockResolvedValue([
        { user_id: 'admin1' }
      ])
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif1' })
    }
  }
}))

// Mock the audit logger
vi.mock('@/lib/audit-logger', () => ({
  auditLogger: {
    logEvent: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('Security Monitoring System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Stop monitoring service if running
    if (securityMonitoringService.getStatus().isRunning) {
      await securityMonitoringService.stop()
    }
  })

  describe('SecurityMetrics', () => {
    it('should record security metrics', async () => {
      await securityMetrics.recordMetric('access_denied_count', 1, {
        userId: 'test-user',
        reason: 'permission_denied'
      })

      const realtimeMetrics = securityMetrics.getRealtimeMetrics('access_denied_count', 10)
      expect(realtimeMetrics).toHaveLength(1)
      expect(realtimeMetrics[0].value).toBe(1)
      expect(realtimeMetrics[0].metadata?.userId).toBe('test-user')
    })

    it('should get access denied count', async () => {
      const count = await securityMetrics.getAccessDeniedCount('1h')
      expect(count).toBe(5) // Mocked value
    })

    it('should get organization access metrics', async () => {
      const metrics = await securityMetrics.getOrganizationAccessMetrics('24h')
      expect(metrics).toHaveProperty('totalAccess')
      expect(metrics).toHaveProperty('successfulAccess')
      expect(metrics).toHaveProperty('deniedAccess')
      expect(metrics).toHaveProperty('uniqueUsers')
    })

    it('should get security dashboard data', async () => {
      const dashboard = await securityMetrics.getSecurityDashboard('24h')
      expect(dashboard).toHaveProperty('accessDenied')
      expect(dashboard).toHaveProperty('rateLimitExceeded')
      expect(dashboard).toHaveProperty('organizationAccess')
      expect(dashboard).toHaveProperty('inviteOperations')
      expect(dashboard).toHaveProperty('securityViolations')
      expect(dashboard).toHaveProperty('performance')
    })
  })

  describe('SecurityAlerts', () => {
    it('should create and store alerts', async () => {
      const alert = {
        id: 'test-alert-1',
        type: 'excessive_access_denied' as const,
        severity: 'HIGH' as const,
        title: 'Test Alert',
        description: 'This is a test alert',
        metadata: { testData: true },
        timestamp: new Date(),
        resolved: false
      }

      await securityAlerts.createAlert(alert)

      const activeAlerts = securityAlerts.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0].id).toBe('test-alert-1')
      expect(activeAlerts[0].severity).toBe('HIGH')
    })

    it('should resolve alerts', async () => {
      const alert = {
        id: 'test-alert-2',
        type: 'rate_limit_abuse' as const,
        severity: 'MEDIUM' as const,
        title: 'Rate Limit Alert',
        description: 'Rate limit exceeded',
        metadata: {},
        timestamp: new Date(),
        resolved: false
      }

      await securityAlerts.createAlert(alert)
      await securityAlerts.resolveAlert('test-alert-2', 'admin-user')

      const activeAlerts = securityAlerts.getActiveAlerts()
      expect(activeAlerts).toHaveLength(0)
    })

    it('should filter alerts by severity', async () => {
      const criticalAlert = {
        id: 'critical-alert',
        type: 'multiple_security_violations' as const,
        severity: 'CRITICAL' as const,
        title: 'Critical Alert',
        description: 'Critical security issue',
        metadata: {},
        timestamp: new Date(),
        resolved: false
      }

      const lowAlert = {
        id: 'low-alert',
        type: 'organization_access_spike' as const,
        severity: 'LOW' as const,
        title: 'Low Alert',
        description: 'Low priority issue',
        metadata: {},
        timestamp: new Date(),
        resolved: false
      }

      await securityAlerts.createAlert(criticalAlert)
      await securityAlerts.createAlert(lowAlert)

      const criticalAlerts = securityAlerts.getAlertsBySeverity('CRITICAL')
      const lowAlerts = securityAlerts.getAlertsBySeverity('LOW')

      expect(criticalAlerts).toHaveLength(1)
      expect(lowAlerts).toHaveLength(1)
      expect(criticalAlerts[0].severity).toBe('CRITICAL')
      expect(lowAlerts[0].severity).toBe('LOW')
    })
  })

  describe('SecurityMonitoringService', () => {
    it('should start and stop monitoring service', async () => {
      expect(securityMonitoringService.getStatus().isRunning).toBe(false)

      await securityMonitoringService.start({
        monitoringIntervalMs: 1000,
        cleanupIntervalMs: 2000,
        enableAlerts: true
      })

      expect(securityMonitoringService.getStatus().isRunning).toBe(true)

      await securityMonitoringService.stop()

      expect(securityMonitoringService.getStatus().isRunning).toBe(false)
    })

    it('should not start if already running', async () => {
      await securityMonitoringService.start()
      expect(securityMonitoringService.getStatus().isRunning).toBe(true)

      // Try to start again
      await securityMonitoringService.start()
      expect(securityMonitoringService.getStatus().isRunning).toBe(true)

      await securityMonitoringService.stop()
    })

    it('should force metrics collection', async () => {
      await securityMonitoringService.start()
      
      // Force metrics collection
      await securityMonitoringService.forceMetricsCollection()
      
      const status = securityMonitoringService.getStatus()
      expect(status.lastMetricsCollection).toBeDefined()

      await securityMonitoringService.stop()
    })
  })

  describe('Integration Tests', () => {
    it('should trigger alerts based on metrics thresholds', async () => {
      // Start monitoring
      await securityMonitoringService.start({
        monitoringIntervalMs: 100, // Very short interval for testing
        enableAlerts: true
      })

      // Record multiple access denied events to trigger threshold
      for (let i = 0; i < 15; i++) {
        await securityMetrics.recordMetric('access_denied_count', 1, {
          userId: `user-${i}`,
          reason: 'test'
        })
      }

      // Wait for monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 200))

      // Check if alerts were triggered
      const activeAlerts = securityAlerts.getActiveAlerts()
      expect(activeAlerts.length).toBeGreaterThan(0)

      await securityMonitoringService.stop()
    })

    it('should clean up old resolved alerts', async () => {
      const oldAlert = {
        id: 'old-alert',
        type: 'excessive_access_denied' as const,
        severity: 'LOW' as const,
        title: 'Old Alert',
        description: 'This is an old alert',
        metadata: {},
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        resolved: true,
        resolvedAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
      }

      await securityAlerts.createAlert(oldAlert)
      await securityAlerts.resolveAlert('old-alert')

      // Force cleanup
      await securityAlerts.cleanupOldAlerts()

      const allAlerts = securityAlerts.getAlertsByType('excessive_access_denied')
      expect(allAlerts).toHaveLength(0)
    })
  })
})