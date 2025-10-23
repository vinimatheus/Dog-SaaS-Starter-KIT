import { startSecurityMonitoring, getSecurityMonitoringStatus } from "./monitoring-service"

/**
 * Auto-start security monitoring when the application starts
 * This ensures monitoring is always active in production
 */
export async function initializeSecurityMonitoring(): Promise<void> {
  // Only auto-start in production or when explicitly enabled
  const shouldAutoStart = process.env.NODE_ENV === "production" || 
                          process.env.SECURITY_MONITORING_AUTO_START === "true"
  
  if (!shouldAutoStart) {
    console.log("[SecurityMonitoring] Auto-start disabled (not in production)")
    return
  }
  
  try {
    const status = getSecurityMonitoringStatus()
    
    if (status.isRunning) {
      console.log("[SecurityMonitoring] Service already running")
      return
    }
    
    console.log("[SecurityMonitoring] Auto-starting security monitoring...")
    
    await startSecurityMonitoring({
      monitoringIntervalMs: 120000,  // 2 minutes in production (less frequent)
      cleanupIntervalMs: 600000,     // 10 minutes cleanup interval
      enableAlerts: true
    })
    
    console.log("[SecurityMonitoring] Auto-start completed successfully")
    
  } catch (error) {
    console.error("[SecurityMonitoring] Failed to auto-start:", error)
    // Don't throw - we don't want to crash the app if monitoring fails to start
  }
}

/**
 * Gracefully shutdown security monitoring
 */
export async function shutdownSecurityMonitoring(): Promise<void> {
  try {
    const { stopSecurityMonitoring } = await import("./monitoring-service")
    await stopSecurityMonitoring()
    console.log("[SecurityMonitoring] Graceful shutdown completed")
  } catch (error) {
    console.error("[SecurityMonitoring] Error during shutdown:", error)
  }
}

// Auto-initialize when this module is imported (in production)
if (typeof window === "undefined") { // Server-side only
  // Use a small delay to ensure the app is fully initialized
  setTimeout(() => {
    initializeSecurityMonitoring().catch(console.error)
  }, 5000) // 5 second delay
}