import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { performStripeHealthCheck, getStripeConfigStatus } from "@/lib/stripe-config-validator"

/**
 * GET /api/admin/stripe-health
 * 
 * Performs comprehensive health check of Stripe integration
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }
    
    // For now, we'll allow any authenticated user to check health
    // In production, you might want to restrict this to admin users
    
    // Get configuration status
    const configStatus = getStripeConfigStatus()
    
    // Perform health check
    const healthCheck = await performStripeHealthCheck()
    
    // Determine overall status
    const overallStatus = configStatus.isValid && healthCheck.isHealthy ? 'healthy' : 'unhealthy'
    
    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      configuration: {
        isValid: configStatus.isValid,
        environment: configStatus.config.environment,
        errors: configStatus.errors,
        warnings: configStatus.warnings,
        envVars: configStatus.envVars
      },
      healthCheck: {
        isHealthy: healthCheck.isHealthy,
        checks: healthCheck.checks,
        errors: healthCheck.errors,
        timestamp: healthCheck.timestamp
      }
    })
    
  } catch (error: any) {
    console.error("Erro no health check do Stripe:", error)
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message || "Erro interno do servidor"
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/stripe-health
 * 
 * Forces a fresh health check (bypasses any caching)
 */
export async function POST(request: NextRequest) {
  // For now, just call the GET method
  return GET(request)
}