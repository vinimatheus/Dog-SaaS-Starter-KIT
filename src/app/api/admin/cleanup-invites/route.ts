import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { triggerManualInviteCleanup, getInviteCleanupStats } from "@/lib/scheduled-jobs"
import { auditLogger } from "@/lib/audit-logger"

/**
 * GET /api/admin/cleanup-invites
 * Get invite cleanup statistics
 */
export async function GET() {
  try {
    const session = await auth()
    
    // For now, allow any authenticated user to view stats
    // In production, you might want to restrict this to admin users
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const stats = await getInviteCleanupStats()
    
    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error("[API] Error getting invite cleanup stats:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/cleanup-invites
 * Manually trigger invite cleanup
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      await auditLogger.logSecurityViolation(undefined, "Unauthorized cleanup attempt", {
        endpoint: "/api/admin/cleanup-invites",
        method: "POST"
      })
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Check for API key for automated systems (optional)
    const apiKey = request.headers.get("x-api-key")
    const expectedApiKey = process.env.CLEANUP_API_KEY
    
    // Allow either authenticated user or valid API key
    const isAuthorized = session.user.id || (apiKey && expectedApiKey && apiKey === expectedApiKey)
    
    if (!isAuthorized) {
      await auditLogger.logSecurityViolation(session.user.id, "Unauthorized cleanup attempt", {
        endpoint: "/api/admin/cleanup-invites",
        method: "POST",
        hasApiKey: !!apiKey
      })
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    // Trigger the cleanup job
    const result = await triggerManualInviteCleanup(session.user.id)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Invite cleanup completed successfully",
        result: result.result
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Cleanup failed"
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[API] Error triggering invite cleanup:", error)
    
    const session = await auth().catch(() => null)
    await auditLogger.logEvent("system_error", {
      userId: session?.user?.id,
      metadata: {
        endpoint: "/api/admin/cleanup-invites",
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }).catch(() => {
      // Ignore audit logging errors
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}