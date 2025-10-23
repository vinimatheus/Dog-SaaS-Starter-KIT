#!/usr/bin/env tsx

/**
 * Security Monitoring Service Startup Script
 * 
 * This script starts the security monitoring service which:
 * - Monitors security metrics continuously
 * - Triggers alerts based on thresholds
 * - Performs cleanup operations
 * - Logs all monitoring activities
 * 
 * Usage:
 *   npm run security:monitor
 *   or
 *   npx tsx scripts/start-security-monitoring.ts
 */

import { startSecurityMonitoring, getSecurityMonitoringStatus } from '../src/lib/security/monitoring-service'

async function main() {
  console.log('🔒 Starting Security Monitoring Service...')
  
  try {
    // Check if already running
    const status = getSecurityMonitoringStatus()
    if (status.isRunning) {
      console.log('⚠️  Security monitoring service is already running')
      process.exit(0)
    }
    
    // Start monitoring with custom configuration
    await startSecurityMonitoring({
      monitoringIntervalMs: 60000,  // Check every minute
      cleanupIntervalMs: 300000,    // Cleanup every 5 minutes
      enableAlerts: true            // Enable alerting
    })
    
    console.log('✅ Security monitoring service started successfully')
    console.log('📊 Monitoring interval: 1 minute')
    console.log('🧹 Cleanup interval: 5 minutes')
    console.log('🚨 Alerts: Enabled')
    console.log('')
    console.log('Press Ctrl+C to stop the service')
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...')
      
      const { stopSecurityMonitoring } = await import('../src/lib/security/monitoring-service')
      await stopSecurityMonitoring()
      
      console.log('✅ Security monitoring service stopped')
      process.exit(0)
    })
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
      
      const { stopSecurityMonitoring } = await import('../src/lib/security/monitoring-service')
      await stopSecurityMonitoring()
      
      console.log('✅ Security monitoring service stopped')
      process.exit(0)
    })
    
    // Keep the process alive
    setInterval(() => {
      const status = getSecurityMonitoringStatus()
      if (!status.isRunning) {
        console.log('❌ Security monitoring service stopped unexpectedly')
        process.exit(1)
      }
    }, 30000) // Check every 30 seconds
    
  } catch (error) {
    console.error('❌ Failed to start security monitoring service:', error)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// Start the service
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})