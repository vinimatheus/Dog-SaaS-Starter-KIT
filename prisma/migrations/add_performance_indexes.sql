-- Add performance indexes for organization security review
-- These indexes will improve query performance for common operations

-- Index for User_Organization lookups by user_id (for getUserOrganizations)
CREATE INDEX IF NOT EXISTS "User_Organization_user_id_idx" ON "User_Organization"("user_id");

-- Index for User_Organization lookups by organization_id (for getOrganizationMembers)
CREATE INDEX IF NOT EXISTS "User_Organization_organization_id_idx" ON "User_Organization"("organization_id");

-- Composite index for User_Organization role-based queries
CREATE INDEX IF NOT EXISTS "User_Organization_org_role_idx" ON "User_Organization"("organization_id", "role");

-- Index for Organization lookups by owner_user_id
CREATE INDEX IF NOT EXISTS "Organization_owner_user_id_idx" ON "Organization"("owner_user_id");

-- Index for Organization created_at for sorting
CREATE INDEX IF NOT EXISTS "Organization_created_at_idx" ON "Organization"("created_at");

-- Composite index for Invite status and expiration queries
CREATE INDEX IF NOT EXISTS "Invite_status_expires_idx" ON "Invite"("status", "expires_at");

-- Index for Invite organization_id and status (for pending invites)
CREATE INDEX IF NOT EXISTS "Invite_org_status_idx" ON "Invite"("organization_id", "status");

-- Index for Invite email and status (for user pending invites)
CREATE INDEX IF NOT EXISTS "Invite_email_status_idx" ON "Invite"("email", "status");

-- Index for Invite expires_at for cleanup operations
CREATE INDEX IF NOT EXISTS "Invite_expires_at_idx" ON "Invite"("expires_at");

-- Index for User sessionVersion for session invalidation
CREATE INDEX IF NOT EXISTS "User_sessionVersion_idx" ON "User"("sessionVersion");

-- Index for User email verification
CREATE INDEX IF NOT EXISTS "User_emailVerified_idx" ON "User"("emailVerified");

-- Composite index for SecurityLog event type and user queries
CREATE INDEX IF NOT EXISTS "SecurityLog_eventType_userId_createdAt_idx" ON "SecurityLog"("eventType", "userId", "createdAt");

-- Index for SecurityLog IP address queries
CREATE INDEX IF NOT EXISTS "SecurityLog_ip_idx" ON "SecurityLog"("ip");

-- Index for Notification user_id and read status
CREATE INDEX IF NOT EXISTS "Notification_user_read_idx" ON "Notification"("user_id", "read");

-- Index for Notification created_at for sorting
CREATE INDEX IF NOT EXISTS "Notification_created_at_idx" ON "Notification"("created_at");

-- Index for LoginAttemptByIP lastAttempt for cleanup
CREATE INDEX IF NOT EXISTS "LoginAttemptByIP_lastAttempt_idx" ON "LoginAttemptByIP"("lastAttempt");

-- Index for LoginAttemptByIP blockedUntil for active blocks
CREATE INDEX IF NOT EXISTS "LoginAttemptByIP_blockedUntil_idx" ON "LoginAttemptByIP"("blockedUntil");

-- Partial index for active sessions (not expired)
CREATE INDEX IF NOT EXISTS "Session_active_idx" ON "Session"("userId", "expires") WHERE "expires" > NOW();

-- Partial index for pending invites (not expired)
CREATE INDEX IF NOT EXISTS "Invite_pending_active_idx" ON "Invite"("organization_id", "email") WHERE "status" = 'PENDING' AND "expires_at" > NOW();

-- Partial index for unread notifications
CREATE INDEX IF NOT EXISTS "Notification_unread_idx" ON "Notification"("user_id", "created_at") WHERE "read" = false;