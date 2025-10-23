import { headers } from "next/headers"
import { prisma } from "./prisma"
import { PlanType } from "@prisma/client"

type SecurityEventType = 
  | "unauthorized_organization_creation"
  | "unauthorized_profile_update"
  | "unauthorized_checkout_redirect"
  | "unauthorized_organization_access"
  | "organization_access"
  | "organization_update"
  | "invite_sent"
  | "invite_accepted"
  | "rate_limit_exceeded"
  | "organization_creation"
  | "checkout_redirect"
  | "profile_update"

type SecurityEventMetadata = {
  name?: string
  organizationId?: string
  plan?: PlanType
  error?: string
  action?: string
  userRole?: string
  requiredRole?: string
  validationErrors?: any[]
  errorMessage?: string
  count?: number
  limit?: number
  windowMs?: number
  firstAttempt?: number
  duration?: number
  [key: string]: any
}

type SecurityEventData = {
  userId?: string
  ip?: string | null
  userAgent?: string | null
  metadata?: SecurityEventMetadata
}

export async function logSecurityEvent(
  eventType: SecurityEventType,
  data: SecurityEventData
) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")
  const userAgent = headersList.get("user-agent")

  await prisma.securityLog.create({
    data: {
      eventType,
      userId: data.userId,
      ip: ip || data.ip,
      userAgent: userAgent || data.userAgent,
      metadata: data.metadata || {},
    },
  })
} 