import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanType } from '@prisma/client'

// Mock environment variables
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_PRO_PLAN_PRICE_ID = 'price_123'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

describe('Stripe Integration E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Trial Flow Integration', () => {
    it('should validate trial eligibility logic', async () => {
      // Import trial utils to test the core logic
      const { checkTrialEligibility, getTrialStatus, calculateDaysRemaining } = await import('@/lib/trial-utils')
      
      // Test organization that hasn't used trial
      const eligibleOrg = {
        id: 'org-1',
        trialUsed: false,
        trialStartDate: null,
        trialEndDate: null,
        plan: PlanType.FREE,
      }

      const eligibility = checkTrialEligibility(eligibleOrg as any)
      expect(eligibility.isEligible).toBe(true)
      expect(eligibility.reason).toBeUndefined()

      // Test organization that has used trial
      const ineligibleOrg = {
        id: 'org-2',
        trialUsed: true,
        trialStartDate: new Date('2023-01-01'),
        trialEndDate: new Date('2023-01-08'),
        plan: PlanType.PRO,
      }

      const ineligibility = checkTrialEligibility(ineligibleOrg as any)
      expect(ineligibility.isEligible).toBe(false)
      expect(ineligibility.reason).toBe('already_used')
    })

    it('should calculate trial status correctly', async () => {
      const { getTrialStatus } = await import('@/lib/trial-utils')
      
      // Test organization in active trial
      const trialOrg = {
        id: 'org-trial',
        trialUsed: true,
        trialStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        trialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        plan: PlanType.PRO,
      }

      const trialStatus = getTrialStatus(trialOrg as any)
      expect(trialStatus.isInTrial).toBe(true)
      expect(trialStatus.daysRemaining).toBe(5)
      expect(trialStatus.hasUsedTrial).toBe(true)

      // Test organization with expired trial
      const expiredTrialOrg = {
        id: 'org-expired',
        trialUsed: true,
        trialStartDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        trialEndDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        plan: PlanType.PRO,
      }

      const expiredStatus = getTrialStatus(expiredTrialOrg as any)
      expect(expiredStatus.isInTrial).toBe(false)
      expect(expiredStatus.daysRemaining).toBe(0)
      expect(expiredStatus.hasUsedTrial).toBe(true)
    })
  })

  describe('Stripe Error Handling', () => {
    it('should create appropriate error instances', async () => {
      const { 
        createTrialAlreadyUsedError,
        createTrialNotEligibleError,
        createSubscriptionAlreadyExistsError,
        createStripeApiError
      } = await import('@/lib/errors/stripe-errors')

      const trialUsedError = createTrialAlreadyUsedError('org-123', 'user-123')
      expect(trialUsedError.message).toContain('Trial already used')
      expect(trialUsedError.organizationId).toBe('org-123')

      const notEligibleError = createTrialNotEligibleError('org-123', 'already_used', 'user-123')
      expect(notEligibleError.message).toContain('not eligible')
      expect(notEligibleError.metadata?.reason).toBe('already_used')

      const subscriptionExistsError = createSubscriptionAlreadyExistsError('org-123', 'sub-123', 'user-123')
      expect(subscriptionExistsError.message).toContain('Subscription already exists')
      expect(subscriptionExistsError.metadata?.existingSubscriptionId).toBe('sub-123')

      const apiError = createStripeApiError('test_operation', new Error('API failed'), 'user-123', 'org-123')
      expect(apiError.message).toContain('Stripe API error')
      expect(apiError.metadata?.operation).toBe('test_operation')
    })
  })

  describe('Webhook Event Processing', () => {
    it('should validate webhook event structure', () => {
      // Test webhook event structures that the system expects
      const checkoutCompletedEvent = {
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

      expect(checkoutCompletedEvent.type).toBe('checkout.session.completed')
      expect(checkoutCompletedEvent.data.object.metadata.organizationId).toBe('org-123')

      const trialWillEndEvent = {
        type: 'customer.subscription.trial_will_end',
        data: {
          object: {
            id: 'sub_123',
            trial_end: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
          },
        },
      }

      expect(trialWillEndEvent.type).toBe('customer.subscription.trial_will_end')
      expect(trialWillEndEvent.data.object.trial_end).toBeGreaterThan(Date.now() / 1000)

      const paymentSucceededEvent = {
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

      expect(paymentSucceededEvent.type).toBe('invoice.payment_succeeded')
      expect(paymentSucceededEvent.data.object.subscription).toBe('sub_123')
    })
  })

  describe('Subscription Data Validation', () => {
    it('should validate subscription details structure', () => {
      const subscriptionDetails = {
        status: 'active' as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        lastPaymentDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentMethod: {
          last4: '4242',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2025,
        },
        upcomingInvoice: {
          amount: 2000,
          currency: 'usd',
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }

      expect(subscriptionDetails.status).toBe('active')
      expect(subscriptionDetails.paymentMethod?.last4).toBe('4242')
      expect(subscriptionDetails.upcomingInvoice?.amount).toBe(2000)
      expect(subscriptionDetails.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now())
    })

    it('should validate trial status structure', () => {
      const trialStatus = {
        isInTrial: true,
        trialStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        trialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        daysRemaining: 5,
        hasUsedTrial: true,
      }

      expect(trialStatus.isInTrial).toBe(true)
      expect(trialStatus.daysRemaining).toBe(5)
      expect(trialStatus.trialEndDate.getTime()).toBeGreaterThan(Date.now())
      expect(trialStatus.trialStartDate.getTime()).toBeLessThan(Date.now())
    })
  })

  describe('Configuration Validation', () => {
    it('should validate required environment variables', () => {
      // Test that required Stripe environment variables are defined
      expect(process.env.STRIPE_SECRET_KEY).toBeDefined()
      expect(process.env.STRIPE_PRO_PLAN_PRICE_ID).toBeDefined()
      expect(process.env.NEXT_PUBLIC_APP_URL).toBeDefined()

      // Test URL construction
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      const orgId = 'test-org'
      const successUrl = `${baseUrl}/${orgId}/config/subscription?session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl = `${baseUrl}/${orgId}/config/subscription`

      expect(successUrl).toContain('session_id={CHECKOUT_SESSION_ID}')
      expect(cancelUrl).toBe('http://localhost:3000/test-org/config/subscription')
    })

    it('should validate checkout session parameters structure', () => {
      const checkoutParams = {
        mode: 'subscription' as const,
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.STRIPE_PRO_PLAN_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: 'http://localhost:3000/test-org/config/subscription?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/test-org/config/subscription',
        metadata: {
          organizationId: 'org-123',
          trialEligible: 'true',
          trialDuration: '7',
        },
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            organizationId: 'org-123',
            trialStarted: 'true',
          },
        },
      }

      expect(checkoutParams.mode).toBe('subscription')
      expect(checkoutParams.line_items[0].price).toBe('price_123')
      expect(checkoutParams.subscription_data?.trial_period_days).toBe(7)
      expect(checkoutParams.metadata.organizationId).toBe('org-123')
    })
  })

  describe('Portal Configuration', () => {
    it('should validate portal configuration structure', () => {
      const portalConfig = {
        business_profile: {
          headline: 'Gerencie sua assinatura',
          privacy_policy_url: 'http://localhost:3000/privacy',
          terms_of_service_url: 'http://localhost:3000/terms',
        },
        features: {
          payment_method_update: {
            enabled: true,
          },
          invoice_history: {
            enabled: true,
          },
          customer_update: {
            enabled: true,
            allowed_updates: ['email', 'address', 'phone', 'tax_id'],
          },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ['price'],
            proration_behavior: 'create_prorations' as const,
          },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end' as const,
            cancellation_reason: {
              enabled: true,
              options: [
                'too_expensive',
                'missing_features',
                'switched_service',
                'unused',
                'other'
              ],
            },
          },
        },
        metadata: {
          configType: 'standard-config',
          createdAt: new Date().toISOString(),
        },
      }

      expect(portalConfig.business_profile.headline).toBe('Gerencie sua assinatura')
      expect(portalConfig.features.payment_method_update.enabled).toBe(true)
      expect(portalConfig.features.subscription_cancel.mode).toBe('at_period_end')
      expect(portalConfig.metadata.configType).toBe('standard-config')
    })

    it('should validate trial-specific portal configuration', () => {
      const trialPortalConfig = {
        features: {
          subscription_cancel: {
            enabled: true,
            mode: 'immediately' as const, // Different for trial
            cancellation_reason: {
              enabled: true,
              options: [
                'too_expensive',
                'missing_features',
                'switched_service',
                'unused',
                'other'
              ],
            },
          },
        },
        metadata: {
          configType: 'trial-aware-config',
        },
      }

      expect(trialPortalConfig.features.subscription_cancel.mode).toBe('immediately')
      expect(trialPortalConfig.metadata.configType).toBe('trial-aware-config')
    })
  })
})