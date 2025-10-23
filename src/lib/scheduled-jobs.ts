/**
 * Scheduled Jobs Utility
 * 
 * Provides functionality for running periodic maintenance tasks
 * including invite cleanup and other system maintenance operations.
 */

import { cleanupExpiredInvites, removeOldExpiredInvites, getInviteCleanupStats } from "./invite-cleanup"
import { auditLogger } from "./audit-logger"

// Re-export for convenience
export { getInviteCleanupStats }

export interface JobResult {
  success: boolean
  jobName: string
  executionTime: number
  result?: any
  error?: string
}

/**
 * Run the invite cleanup job
 * This should be called periodically (e.g., every hour or daily)
 */
export async function runInviteCleanupJob(): Promise<JobResult> {
  const startTime = Date.now()
  const jobName = "invite-cleanup"

  try {
    console.log("[ScheduledJobs] Starting invite cleanup job...")

    // First, get stats before cleanup
    const statsBefore = await getInviteCleanupStats()
    
    // Run the cleanup operations
    const [expiredResult, oldInvitesResult] = await Promise.all([
      cleanupExpiredInvites(),
      removeOldExpiredInvites()
    ])

    // Get stats after cleanup
    const statsAfter = await getInviteCleanupStats()

    const executionTime = Date.now() - startTime
    const result = {
      expiredInvitesUpdated: expiredResult.cleanedCount,
      oldInvitesRemoved: oldInvitesResult.cleanedCount,
      statsBefore,
      statsAfter,
      executionTimeMs: executionTime
    }

    // Log the job execution
    // Note: Using system_error event type for all system operations since custom types aren't available
    await auditLogger.logEvent("system_error", {
      metadata: {
        jobName,
        executionTime,
        result,
        success: expiredResult.success && oldInvitesResult.success,
        operationType: "scheduled_job_completed"
      }
    })

    console.log(`[ScheduledJobs] Invite cleanup job completed in ${executionTime}ms:`, result)

    return {
      success: expiredResult.success && oldInvitesResult.success,
      jobName,
      executionTime,
      result
    }
  } catch (error) {
    const executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    console.error(`[ScheduledJobs] Invite cleanup job failed after ${executionTime}ms:`, error)

    // Log the job failure
    await auditLogger.logEvent("system_error", {
      metadata: {
        jobName,
        executionTime,
        error: errorMessage,
        operationType: "scheduled_job_failed"
      }
    }).catch(() => {
      // Ignore audit logging errors
    })

    return {
      success: false,
      jobName,
      executionTime,
      error: errorMessage
    }
  }
}

/**
 * Run all scheduled maintenance jobs
 * This is the main entry point for periodic system maintenance
 */
export async function runAllScheduledJobs(): Promise<JobResult[]> {
  console.log("[ScheduledJobs] Starting all scheduled jobs...")
  
  const jobs = [
    runInviteCleanupJob()
    // Add other scheduled jobs here in the future
  ]

  const results = await Promise.allSettled(jobs)
  
  const jobResults: JobResult[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value
    } else {
      return {
        success: false,
        jobName: `job-${index}`,
        executionTime: 0,
        error: result.reason instanceof Error ? result.reason.message : "Job failed"
      }
    }
  })

  const successCount = jobResults.filter(r => r.success).length
  const totalJobs = jobResults.length

  console.log(`[ScheduledJobs] Completed ${successCount}/${totalJobs} scheduled jobs`)

  return jobResults
}

/**
 * Create a simple interval-based scheduler for development/testing
 * In production, this should be replaced with a proper job scheduler like cron
 */
export function startInviteCleanupScheduler(intervalMinutes: number = 60) {
  console.log(`[ScheduledJobs] Starting invite cleanup scheduler (every ${intervalMinutes} minutes)`)
  
  const intervalMs = intervalMinutes * 60 * 1000
  
  // Run immediately on start
  runInviteCleanupJob().catch(error => {
    console.error("[ScheduledJobs] Initial cleanup job failed:", error)
  })
  
  // Then run on interval
  const intervalId = setInterval(() => {
    runInviteCleanupJob().catch(error => {
      console.error("[ScheduledJobs] Scheduled cleanup job failed:", error)
    })
  }, intervalMs)

  // Return a function to stop the scheduler
  return () => {
    console.log("[ScheduledJobs] Stopping invite cleanup scheduler")
    clearInterval(intervalId)
  }
}

/**
 * Manual trigger for invite cleanup (useful for API endpoints or admin tools)
 */
export async function triggerManualInviteCleanup(userId?: string): Promise<JobResult> {
  console.log(`[ScheduledJobs] Manual invite cleanup triggered${userId ? ` by user ${userId}` : ""}`)
  
  // Log the manual trigger
  if (userId) {
    await auditLogger.logEvent("system_error", {
      userId,
      metadata: {
        jobType: "invite-cleanup",
        triggeredAt: new Date().toISOString(),
        operationType: "manual_cleanup_triggered"
      }
    }).catch(() => {
      // Ignore audit logging errors
    })
  }

  return runInviteCleanupJob()
}