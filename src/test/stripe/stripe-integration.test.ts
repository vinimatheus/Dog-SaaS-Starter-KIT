import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PlanType } from '@prisma/client'

// Mock Stripe first
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
      configurations: {
        list: vi.fn(),
        create: vi.fn(),
      },
    },
    subscriptions: {
      list: vi.fn(),
      retrieve: vi.fn(),
      cancel: vi.fn(),
      update: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
    invoices: {
      list: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock permission manager
vi.mock('@/lib/permission-manager', () => ({
  permissionManager: {
    canManageSubscription: vi.fn().mockResolvedValue(true),
  },
}))

// Mock trial utils
vi.mock('@/lib/trial-utils', () => ({
  checkTrialEligibility: vi.fn(),
  getTrialStatus: vi.fn(),
  TRIAL_DURATION_DAYS: 7,
}))

// Mock error classes
vi.mock('@/lib/errors/stripe-errors', () => ({
  TrialAlreadyUsedError: class extends Error {},
  TrialNotEligibleError: class extends Error {},
  SubscriptionAlreadyExistsError: class extends Error {},
  SubscriptionNotFoundError: class extends Error {},
  StripeApiError: class extends Error {},
  createTrialAlreadyUsedError: vi.fn(),
  createTrialNotEligibleError: vi.fn(),
  createSubscriptionAlreadyExistsError: vi.fn(),
  createSubscriptionNotFoundError: vi.fn(),
  createStripeApiError: vi.fn(),
}))

// Mock audit logger
vi.mock('@/lib/audit-logger', () => ({
  auditLogger: {
    logEvent: vi.fn(),
  },
}))

// Mock portal activity logger
vi.mock('@/lib/portal-activity-logger', () => ({
  trackPortalSessionStart: vi.fn(),
  trackPortalSessionEnd: vi.fn(),
}))

// Import after mocks
import { 
  createCheckoutSession, 
  createCustomerPortalSession,
  getTrialStatusAction,
  getSubscriptionDetailsAction,
  cancelSubscription,
  handleStripeWebhookAction,
  handlePortalReturn
} from '@/actions/stripe.actions'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { stripe } from '@/lib/stripe'

describe('Stripe Integration End-to-End Tests', () => {
  const mockOrganization = {
    id: 'org-123',
    uniqueId: 'test-org',
    plan: PlanType.FREE,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialStartDate: null,
    trialEndDate: null,
    trialUsed: false,
    subscriptionStatus: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    lastPaymentDate: null,
    nextBillingDate: null,
    paymentMethodLast4: null,
    paymentMethodBrand: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any)
    vi.mocked(prisma.organization.update).mockResolvedValue(mockOrganization as any)
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(mockOrganization as any)
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'test-user-id' },
    } as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Trial Signup Flow', () => {
    it('should create checkout session with trial for eligible organization', async () => {
      // Mock trial eligibility check
      const { checkTrialEligibility } = await import('@/lib/trial-utils')
      vi.mocked(checkTrialEligibility).mockReturnValue({
        isEligible: true,
        reason: null,
      })

      // Mock Stripe checkout session creation
      vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
        url: 'https://checkout.stripe.com/session-123',
      } as any)

      const result = await createCheckoutSession('org-123')

      expect(result).toEqual({ url: 'https://checkout.stripe.com/session-123' })
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          subscription_data: expect.objectContaining({
            trial_period_days: 7,
            metadata: expect.objectContaining({
              organizationId: 'org-123',
              trialStarted: 'true',
            }),
          }),
          metadata: expect.objectContaining({
            organizationId: 'org-123',
            trialEligible: 'true',
            trialDuration: '7',
          }),
        })
      )
    })

    it('should create checkout session without trial for ineligible organization', async () => {
      // Mock trial eligibility check
      const { checkTrialEligibility } = await import('@/lib/trial-utils')
      vi.mocked(checkTrialEligibility).mockReturnValue({
        isEligible: false,
        reason: 'trial_already_used',
      })

      // Mock Stripe checkout session creation
      vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
        url: 'https://checkout.stripe.com/session-123',
      } as any)

      const result = await createCheckoutSession('org-123')

      expect(result).toEqual({ url: 'https://checkout.stripe.com/session-123' })
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          subscription_data: expect.anything(),
        })
      )
    })
  })

  describe('Trial to Paid Conversion', () => {
    it('should handle checkout.session.completed webhook with trial', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            metadata: {
              organizationId: 'org-123',
            },
          },
        },
      }

      // Mock Stripe subscription retrieval
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_123',
        status: 'trialing',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        cancel_at_period_end: false,
        trial_end: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000),
      } as any)

      // Mock webhook construction
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const result = await handleStripeWebhookAction(
        'test-signature',
        Buffer.from('test-payload'),
        'test-webhook-secret'
      )

      expect(result).toEqual({ success: true })
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          plan: PlanType.PRO,
          stripeSubscriptionId: 'sub_123',
          stripeCustomerId: 'cus_123',
          subscriptionStatus: 'trialing',
          trialStartDate: expect.any(Date),
          trialEndDate: expect.any(Date),
          trialUsed: true,
        }),
      })
    })

    it('should handle customer.subscription.trial_will_end webhook', async () => {
      const mockEvent = {
        type: 'customer.subscription.trial_will_end',
        data: {
          object: {
            id: 'sub_123',
            trial_end: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000), // 1 day from now
          },
        },
      }

      // Mock organization with subscription
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        ...mockOrganization,
        stripeSubscriptionId: 'sub_123',
      } as any)

      // Mock webhook construction
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const result = await handleStripeWebhookAction(
        'test-signature',
        Buffer.from('test-payload'),
        'test-webhook-secret'
      )

      expect(result).toEqual({ success: true })
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          trialEndDate: expect.any(Date),
        },
      })
    })

    it('should handle invoice.payment_succeeded after trial', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
            status_transitions: {
              paid_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      }

      // Mock organization with subscription
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        ...mockOrganization,
        stripeSubscriptionId: 'sub_123',
      } as any)

      // Mock webhook construction
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const result = await handleStripeWebhookAction(
        'test-signature',
        Buffer.from('test-payload'),
        'test-webhook-secret'
      )

      expect(result).toEqual({ success: true })
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          lastPaymentDate: expect.any(Date),
          subscriptionStatus: 'active',
        },
      })
    })
  })

  describe('Subscription Management through Portal', () => {
    it('should create customer portal session for trial subscription', async () => {
      // Mock organization with trial subscription
      const orgWithTrial = {
        ...mockOrganization,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        plan: PlanType.PRO,
      }

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(orgWithTrial as any)

      // Mock trial status
      const { getTrialStatus } = await import('@/lib/trial-utils')
      vi.mocked(getTrialStatus).mockReturnValue({
        isInTrial: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        daysRemaining: 5,
        hasUsedTrial: true,
      })

      // Mock portal configuration
      vi.mocked(stripe.billingPortal.configurations.list).mockResolvedValue({
        data: [],
      } as any)

      vi.mocked(stripe.billingPortal.configurations.create).mockResolvedValue({
        id: 'bpc_123',
      } as any)

      // Mock portal session creation
      vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
        id: 'bps_123',
        url: 'https://billing.stripe.com/session-123',
      } as any)

      const result = await createCustomerPortalSession('org-123')

      expect(result).toEqual({ url: 'https://billing.stripe.com/session-123' })
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
          configuration: 'bpc_123',
        })
      )
    })

    it('should handle portal return and sync subscription data', async () => {
      // Mock organization with subscription
      const orgWithSubscription = {
        ...mockOrganization,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        plan: PlanType.PRO,
      }

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(orgWithSubscription as any)

      // Mock Stripe subscription retrieval with updated data
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        cancel_at_period_end: false,
        trial_end: null,
        default_payment_method: {
          card: {
            last4: '4242',
            brand: 'visa',
            exp_month: 12,
            exp_year: 2025,
          },
        },
      } as any)

      const result = await handlePortalReturn('org-123')

      expect(result).toEqual({ success: true })
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          subscriptionStatus: 'active',
          cancelAtPeriodEnd: false,
          paymentMethodLast4: '4242',
          paymentMethodBrand: 'visa',
          nextBillingDate: expect.any(Date),
        }),
      })
    })
  })

  describe('Trial Status and Subscription Details', () => {
    it('should get trial status for organization in trial', async () => {
      const { getTrialStatus } = await import('@/lib/trial-utils')
      const mockTrialStatus = {
        isInTrial: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        daysRemaining: 5,
        hasUsedTrial: true,
      }

      vi.mocked(getTrialStatus).mockReturnValue(mockTrialStatus)

      const result = await getTrialStatusAction('org-123')

      expect(result).toEqual(mockTrialStatus)
      expect(getTrialStatus).toHaveBeenCalledWith(mockOrganization)
    })

    it('should get comprehensive subscription details', async () => {
      // Mock organization with subscription
      const orgWithSubscription = {
        ...mockOrganization,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        plan: PlanType.PRO,
        subscriptionStatus: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        paymentMethodLast4: '4242',
        paymentMethodBrand: 'visa',
      }

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(orgWithSubscription as any)

      // Mock Stripe subscription retrieval
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        cancel_at_period_end: false,
        trial_end: null,
        default_payment_method: {
          card: {
            last4: '4242',
            brand: 'visa',
            exp_month: 12,
            exp_year: 2025,
          },
        },
      } as any)

      // Mock upcoming invoice
      vi.mocked(stripe.invoices.list).mockResolvedValue({
        data: [{
          id: 'in_123',
          amount_due: 2000,
          currency: 'usd',
          period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        }],
      } as any)

      const result = await getSubscriptionDetailsAction('org-123')

      expect(result).toEqual(expect.objectContaining({
        status: 'active',
        cancelAtPeriodEnd: false,
        paymentMethod: expect.objectContaining({
          last4: '4242',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2025,
        }),
        upcomingInvoice: expect.objectContaining({
          amount: 2000,
          currency: 'usd',
        }),
      }))
    })
  })

  describe('Subscription Cancellation', () => {
    it('should cancel trial subscription immediately', async () => {
      // Mock organization with trial subscription
      const orgWithTrial = {
        ...mockOrganization,
        stripeSubscriptionId: 'sub_123',
        plan: PlanType.PRO,
      }

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(orgWithTrial as any)

      // Mock Stripe subscription retrieval showing trial status
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_123',
        status: 'trialing',
      } as any)

      // Mock subscription cancellation
      vi.mocked(stripe.subscriptions.cancel).mockResolvedValue({
        id: 'sub_123',
        status: 'canceled',
      } as any)

      const result = await cancelSubscription('org-123')

      expect(result).toEqual({ success: true })
      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123')
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          plan: PlanType.FREE,
          stripeSubscriptionId: null,
          subscriptionStatus: 'canceled',
          cancelAtPeriodEnd: false,
        },
      })
    })

    it('should cancel active subscription at period end', async () => {
      // Mock organization with active subscription
      const orgWithSubscription = {
        ...mockOrganization,
        stripeSubscriptionId: 'sub_123',
        plan: PlanType.PRO,
      }

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(orgWithSubscription as any)

      // Mock Stripe subscription retrieval showing active status
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_123',
        status: 'active',
      } as any)

      // Mock subscription update for cancellation at period end
      vi.mocked(stripe.subscriptions.update).mockResolvedValue({
        id: 'sub_123',
        cancel_at_period_end: true,
      } as any)

      const result = await cancelSubscription('org-123')

      expect(result).toEqual({ success: true })
      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      })
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          cancelAtPeriodEnd: true,
        },
      })
    })
  })

  describe('Webhook Processing Accuracy', () => {
    it('should handle customer.subscription.deleted webhook', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
          },
        },
      }

      // Mock organization with subscription
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        ...mockOrganization,
        stripeSubscriptionId: 'sub_123',
        plan: PlanType.PRO,
      } as any)

      // Mock webhook construction
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const result = await handleStripeWebhookAction(
        'test-signature',
        Buffer.from('test-payload'),
        'test-webhook-secret'
      )

      expect(result).toEqual({ success: true })
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          plan: PlanType.FREE,
          stripeSubscriptionId: null,
          subscriptionStatus: 'canceled',
          cancelAtPeriodEnd: false,
        },
      })
    })

    it('should handle invoice.payment_failed webhook', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
          },
        },
      }

      // Mock organization with subscription
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        ...mockOrganization,
        stripeSubscriptionId: 'sub_123',
      } as any)

      // Mock webhook construction
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const result = await handleStripeWebhookAction(
        'test-signature',
        Buffer.from('test-payload'),
        'test-webhook-secret'
      )

      expect(result).toEqual({ success: true })
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          subscriptionStatus: 'past_due',
        },
      })
    })

    it('should handle webhook signature validation errors', async () => {
      // Mock webhook construction to throw error
      vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      await expect(
        handleStripeWebhookAction(
          'invalid-signature',
          Buffer.from('test-payload'),
          'test-webhook-secret'
        )
      ).rejects.toThrow('Invalid signature')
    })
  })
})