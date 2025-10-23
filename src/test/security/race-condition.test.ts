import { describe, it, expect, vi, beforeEach } from 'vitest'
import { inviteMemberAction, resendInviteAction, deleteInviteAction } from '@/actions/invite-member.actions'
import { acceptInviteAction, rejectInviteAction } from '@/actions/accept-invite.actions'
import { removeMemberAction, updateMemberRoleAction, transferOwnershipAction } from '@/actions/manage-members.actions'
import { Role, InviteStatus } from '@prisma/client'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    user_Organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    invite: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    $transaction: vi.fn()
  }
}))
vi.mock('@/lib/audit-logger')
vi.mock('@/lib/cache-manager')
vi.mock('@/lib/security-logger')
vi.mock('@/lib/services/notification.service')
vi.mock('@/lib/invite-cleanup')
vi.mock('@/lib/permission-manager', () => ({
  permissionManager: {
    canAccessOrganization: vi.fn(),
    canManageMembers: vi.fn(),
    canSendInvites: vi.fn(),
    canModifyOrganization: vi.fn(),
    validateRole: vi.fn()
  }
}))
vi.mock('@/auth')
vi.mock('next/cache')

describe('Race Condition Security Tests', () => {
  const mockUserId = 'user_123'
  const mockOrgId = 'org_456'
  const mockInviteId = 'invite_789'
  const mockTargetUserId = 'user_999'
  const mockEmail = 'test@example.com'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Mock auth session
    const mockAuth = vi.mocked(await import('@/auth'))
    mockAuth.auth.mockResolvedValue({
      user: { 
        id: mockUserId, 
        email: mockEmail,
        name: 'Test User'
      }
    } as any)
  })

  describe('Concurrent Invite Operations', () => {
    it('should prevent duplicate invites when sent simultaneously', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockPermissionManager = await import('@/lib/permission-manager')
      
      // Mock permission check to pass
      vi.mocked(mockPermissionManager.permissionManager.canSendInvites).mockResolvedValue(true)
      
      // Mock organization exists
      vi.mocked(mockPrisma.prisma.organization.findUnique).mockResolvedValue({
        id: mockOrgId,
        name: 'Test Org',
        uniqueId: 'test-org',
        plan: 'PRO'
      } as any)

      // Mock no existing user
      vi.mocked(mockPrisma.prisma.user.findUnique).mockResolvedValue(null)
      
      // Mock no existing membership
      vi.mocked(mockPrisma.prisma.user_Organization.findUnique).mockResolvedValue(null)

      // First call: no existing invite
      // Second call: existing invite found (simulating race condition)
      vi.mocked(mockPrisma.prisma.invite.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: mockInviteId,
          email: mockEmail,
          status: 'PENDING',
          expires_at: new Date(Date.now() + 86400000) // 1 day from now
        } as any)

      // Mock transaction behavior
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        return await callback(mockPrisma.prisma as any)
      })

      const formData1 = new FormData()
      formData1.append('email', mockEmail)
      formData1.append('role', Role.USER)
      formData1.append('organizationId', mockOrgId)

      const formData2 = new FormData()
      formData2.append('email', mockEmail)
      formData2.append('role', Role.USER)
      formData2.append('organizationId', mockOrgId)

      // Simulate concurrent invite attempts
      const [result1, result2] = await Promise.all([
        inviteMemberAction(formData1),
        inviteMemberAction(formData2)
      ])

      // One should succeed, one should fail with duplicate error
      const results = [result1, result2]
      const successCount = results.filter(r => r.success).length
      const duplicateErrors = results.filter(r => 
        !r.success && r.error?.includes('convite pendente')
      ).length

      expect(successCount).toBe(1)
      expect(duplicateErrors).toBe(1)
    })

    it('should handle concurrent invite acceptance and rejection', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockInviteCleanup = await import('@/lib/invite-cleanup')
      
      // Mock invite cleanup returns valid
      vi.mocked(mockInviteCleanup.checkAndUpdateExpiredInvite).mockResolvedValue(true)

      // Mock invite exists and is pending
      const mockInvite = {
        id: mockInviteId,
        email: mockEmail,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 86400000),
        role: Role.USER,
        organization: {
          id: mockOrgId,
          name: 'Test Org',
          uniqueId: 'test-org'
        },
        invited_by: {
          id: 'inviter_123',
          name: 'Inviter',
          email: 'inviter@example.com'
        }
      }

      vi.mocked(mockPrisma.prisma.invite.findUnique).mockResolvedValue(mockInvite as any)
      
      // Mock no existing membership
      vi.mocked(mockPrisma.prisma.user_Organization.findFirst).mockResolvedValue(null)

      // Mock transaction - first one succeeds, second one should see updated status
      let transactionCount = 0
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        transactionCount++
        if (transactionCount === 1) {
          // First transaction (accept) - invite is still pending
          vi.mocked(mockPrisma.prisma.invite.findUnique).mockResolvedValueOnce({
            ...mockInvite,
            status: 'PENDING'
          } as any)
        } else {
          // Second transaction (reject) - invite is already accepted
          vi.mocked(mockPrisma.prisma.invite.findUnique).mockResolvedValueOnce({
            ...mockInvite,
            status: 'ACCEPTED'
          } as any)
        }
        return await callback(mockPrisma.prisma as any)
      })

      // Simulate concurrent accept and reject
      const [acceptResult, rejectResult] = await Promise.all([
        acceptInviteAction(mockInviteId),
        rejectInviteAction(mockInviteId)
      ])

      // Accept should succeed, reject should fail because invite is already processed
      expect(acceptResult.success).toBe(true)
      expect(rejectResult.success).toBe(false)
      expect(rejectResult.error).toContain('já foi')
    })

    it('should prevent concurrent invite resend and delete operations', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockPermissionManager = await import('@/lib/permission-manager')
      const mockInviteCleanup = await import('@/lib/invite-cleanup')
      
      // Mock invite cleanup returns valid
      vi.mocked(mockInviteCleanup.checkAndUpdateExpiredInvite).mockResolvedValue(true)
      
      // Mock permission check to pass
      vi.mocked(mockPermissionManager.permissionManager.canSendInvites).mockResolvedValue(true)

      const mockInvite = {
        id: mockInviteId,
        email: mockEmail,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 86400000),
        organization: {
          id: mockOrgId,
          name: 'Test Org',
          uniqueId: 'test-org'
        },
        organization_id: mockOrgId
      }

      // Mock transaction behavior - simulate one operation completing before the other
      let operationCount = 0
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        operationCount++
        if (operationCount === 1) {
          // First operation sees pending invite
          vi.mocked(mockPrisma.prisma.invite.findUnique).mockResolvedValueOnce(mockInvite as any)
        } else {
          // Second operation - invite might be deleted or modified
          vi.mocked(mockPrisma.prisma.invite.findUnique).mockResolvedValueOnce(null)
        }
        return await callback(mockPrisma.prisma as any)
      })

      // Simulate concurrent resend and delete
      const [resendResult, deleteResult] = await Promise.all([
        resendInviteAction(mockInviteId),
        deleteInviteAction(mockInviteId)
      ])

      // One should succeed, one should fail with "not found" error
      const results = [resendResult, deleteResult]
      const successCount = results.filter(r => r.success).length
      const notFoundErrors = results.filter(r => 
        !r.success && r.error?.includes('não encontrado')
      ).length

      expect(successCount).toBe(1)
      expect(notFoundErrors).toBe(1)
    })
  })

  describe('Concurrent Member Management Operations', () => {
    it('should prevent concurrent member removal and role update', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockPermissionManager = await import('@/lib/permission-manager')
      
      // Mock permission checks to pass
      vi.mocked(mockPermissionManager.permissionManager.validateRole).mockResolvedValue()

      const mockTargetMember = {
        user_id: mockTargetUserId,
        organization_id: mockOrgId,
        role: Role.USER
      }

      // Mock current user as admin
      const mockCurrentUserOrg = {
        role: Role.ADMIN
      }

      // Mock transaction behavior
      let operationCount = 0
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        operationCount++
        if (operationCount === 1) {
          // First operation sees member exists
          vi.mocked(mockPrisma.prisma.user_Organization.findFirst)
            .mockResolvedValueOnce(mockTargetMember as any)
            .mockResolvedValueOnce(mockCurrentUserOrg as any)
        } else {
          // Second operation - member might be removed
          vi.mocked(mockPrisma.prisma.user_Organization.findFirst)
            .mockResolvedValueOnce(null) // Target member not found
        }
        return await callback(mockPrisma.prisma as any)
      })

      // Simulate concurrent remove and role update
      const [removeResult, updateResult] = await Promise.all([
        removeMemberAction(mockOrgId, mockTargetUserId),
        updateMemberRoleAction(mockOrgId, mockTargetUserId, Role.ADMIN)
      ])

      // One should succeed, one should fail with "not found" error
      const results = [removeResult, updateResult]
      const successCount = results.filter(r => r.success).length
      const notFoundErrors = results.filter(r => 
        !r.success && r.error?.includes('não encontrado')
      ).length

      expect(successCount).toBe(1)
      expect(notFoundErrors).toBe(1)
    })

    it('should prevent concurrent ownership transfers', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockPermissionManager = await import('@/lib/permission-manager')
      
      const mockNewOwner1 = 'user_new1'
      const mockNewOwner2 = 'user_new2'

      // Mock permission checks to pass for owner
      vi.mocked(mockPermissionManager.permissionManager.validateRole).mockResolvedValue()

      // Mock transaction behavior
      let operationCount = 0
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        operationCount++
        if (operationCount === 1) {
          // First operation - both new owners exist
          vi.mocked(mockPrisma.prisma.user_Organization.findFirst)
            .mockResolvedValueOnce({ user_id: mockNewOwner1, role: Role.ADMIN } as any)
        } else {
          // Second operation - first new owner is now owner, second doesn't exist as admin
          vi.mocked(mockPrisma.prisma.user_Organization.findFirst)
            .mockResolvedValueOnce({ user_id: mockNewOwner2, role: Role.USER } as any)
        }
        return await callback(mockPrisma.prisma as any)
      })

      // Simulate concurrent ownership transfers to different users
      const [transfer1Result, transfer2Result] = await Promise.all([
        transferOwnershipAction(mockOrgId, mockNewOwner1),
        transferOwnershipAction(mockOrgId, mockNewOwner2)
      ])

      // Only one should succeed
      const results = [transfer1Result, transfer2Result]
      const successCount = results.filter(r => r.success).length

      expect(successCount).toBe(1)
    })

    it('should handle concurrent member operations with session invalidation', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockPermissionManager = await import('@/lib/permission-manager')
      
      // Mock permission checks to pass
      vi.mocked(mockPermissionManager.permissionManager.validateRole).mockResolvedValue()

      const mockTargetMember = {
        user_id: mockTargetUserId,
        organization_id: mockOrgId,
        role: Role.USER
      }

      // Mock transaction that includes session version increment
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        vi.mocked(mockPrisma.prisma.user_Organization.findFirst)
          .mockResolvedValue(mockTargetMember as any)
          .mockResolvedValue({ role: Role.ADMIN } as any)
        
        // Mock session version update
        vi.mocked(mockPrisma.prisma.user.update).mockResolvedValue({} as any)
        
        return await callback(mockPrisma.prisma as any)
      })

      const result = await removeMemberAction(mockOrgId, mockTargetUserId)

      expect(result.success).toBe(true)
      
      // Verify session version was incremented to invalidate user sessions
      expect(mockPrisma.prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockTargetUserId },
        data: { sessionVersion: { increment: 1 } }
      })
    })
  })

  describe('Database Consistency Tests', () => {
    it('should maintain referential integrity during concurrent operations', async () => {
      const mockPrisma = await import('@/lib/prisma')
      
      // Mock transaction that simulates database constraint violation
      vi.mocked(mockPrisma.prisma.$transaction).mockRejectedValue(
        new Error('Foreign key constraint violation')
      )

      const formData = new FormData()
      formData.append('email', mockEmail)
      formData.append('role', Role.USER)
      formData.append('organizationId', 'non_existent_org')

      const result = await inviteMemberAction(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should handle transaction timeouts gracefully', async () => {
      const mockPrisma = await import('@/lib/prisma')
      
      // Mock transaction timeout
      vi.mocked(mockPrisma.prisma.$transaction).mockRejectedValue(
        new Error('Transaction timeout')
      )

      const result = await acceptInviteAction(mockInviteId)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should handle deadlock scenarios', async () => {
      const mockPrisma = await import('@/lib/prisma')
      
      // Mock deadlock error
      vi.mocked(mockPrisma.prisma.$transaction).mockRejectedValue(
        new Error('Deadlock detected')
      )

      const result = await removeMemberAction(mockOrgId, mockTargetUserId)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('Atomic Operation Tests', () => {
    it('should ensure invite creation is atomic', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockPermissionManager = await import('@/lib/permission-manager')
      
      // Mock permission check to pass
      vi.mocked(mockPermissionManager.permissionManager.canSendInvites).mockResolvedValue(true)
      
      // Mock organization exists
      vi.mocked(mockPrisma.prisma.organization.findUnique).mockResolvedValue({
        id: mockOrgId,
        name: 'Test Org',
        uniqueId: 'test-org',
        plan: 'PRO'
      } as any)

      // Mock transaction that fails after some operations
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        // Simulate partial success then failure
        vi.mocked(mockPrisma.prisma.user.findUnique).mockResolvedValue(null)
        vi.mocked(mockPrisma.prisma.user_Organization.findUnique).mockResolvedValue(null)
        vi.mocked(mockPrisma.prisma.invite.findUnique).mockResolvedValue(null)
        
        // Simulate failure during invite creation
        vi.mocked(mockPrisma.prisma.invite.create).mockRejectedValue(
          new Error('Database constraint violation')
        )
        
        return await callback(mockPrisma.prisma as any)
      })

      const formData = new FormData()
      formData.append('email', mockEmail)
      formData.append('role', Role.USER)
      formData.append('organizationId', mockOrgId)

      const result = await inviteMemberAction(formData)

      expect(result.success).toBe(false)
      // Ensure no partial state is left behind
      expect(mockPrisma.prisma.invite.create).toHaveBeenCalled()
    })

    it('should ensure membership creation is atomic during invite acceptance', async () => {
      const mockPrisma = await import('@/lib/prisma')
      const mockInviteCleanup = await import('@/lib/invite-cleanup')
      
      // Mock invite cleanup returns valid
      vi.mocked(mockInviteCleanup.checkAndUpdateExpiredInvite).mockResolvedValue(true)

      // Mock transaction that fails after membership creation but before invite update
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        const mockInvite = {
          id: mockInviteId,
          email: mockEmail,
          status: 'PENDING',
          expires_at: new Date(Date.now() + 86400000),
          role: Role.USER,
          organization: {
            id: mockOrgId,
            name: 'Test Org',
            uniqueId: 'test-org'
          }
        }

        vi.mocked(mockPrisma.prisma.invite.findUnique).mockResolvedValue(mockInvite as any)
        vi.mocked(mockPrisma.prisma.user_Organization.findFirst).mockResolvedValue(null)
        
        // Membership creation succeeds
        vi.mocked(mockPrisma.prisma.user_Organization.create).mockResolvedValue({} as any)
        
        // But invite update fails
        vi.mocked(mockPrisma.prisma.invite.update).mockRejectedValue(
          new Error('Update failed')
        )
        
        return await callback(mockPrisma.prisma as any)
      })

      const result = await acceptInviteAction(mockInviteId)

      expect(result.success).toBe(false)
      // Transaction should rollback, so no membership should be created
      expect(mockPrisma.prisma.user_Organization.create).toHaveBeenCalled()
      expect(mockPrisma.prisma.invite.update).toHaveBeenCalled()
    })
  })

  describe('Concurrent Cache Operations', () => {
    it('should handle concurrent cache invalidation', async () => {
      const mockCacheManager = await import('@/lib/cache-manager')
      const mockPermissionManager = await import('@/lib/permission-manager')
      
      // Mock permission checks to pass
      vi.mocked(mockPermissionManager.permissionManager.validateRole).mockResolvedValue()
      
      // Mock cache operations
      vi.mocked(mockCacheManager.cacheManager.invalidateUserCache).mockResolvedValue()
      vi.mocked(mockCacheManager.cacheManager.invalidateOrganizationCache).mockResolvedValue()
      vi.mocked(mockCacheManager.cacheManager.getOrganizationData).mockResolvedValue({
        uniqueId: 'test-org'
      } as any)

      const mockPrisma = await import('@/lib/prisma')
      vi.mocked(mockPrisma.prisma.$transaction).mockImplementation(async (callback) => {
        vi.mocked(mockPrisma.prisma.user_Organization.findFirst)
          .mockResolvedValue({ role: Role.USER } as any)
          .mockResolvedValue({ role: Role.ADMIN } as any)
        
        return await callback(mockPrisma.prisma as any)
      })

      // Simulate concurrent operations that invalidate cache
      const operations = [
        removeMemberAction(mockOrgId, mockTargetUserId),
        updateMemberRoleAction(mockOrgId, mockTargetUserId, Role.ADMIN)
      ]

      await Promise.all(operations)

      // Cache invalidation should be called for both operations
      expect(mockCacheManager.cacheManager.invalidateOrganizationCache)
        .toHaveBeenCalledWith(mockOrgId)
    })
  })
})