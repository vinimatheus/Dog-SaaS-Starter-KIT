// Enhanced webhook handler with retry logic and comprehensive logging
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { auditLogger } from "@/lib/audit-logger"
import { errorHandler } from "@/lib/errors/error-handler"
import { trackPortalAction } from "@/lib/portal-activity-logger"
import {
  WebhookError,
  WebhookSignatureError,
  WebhookProcessingError,
  StripeApiError,
  createWebhookSignatureError,
  createWebhookProcessingError,
  createStripeApiError
} from "@/lib/errors/stripe-errors"

/**
 * Webhook processing result
 */
interface WebhookProcessingResult {
  success: boolean
  eventId: string
  eventType: string
  processed: boolean
  retryCount?: number
  error?: string
}

/**
 * Webhook retry configuration
 */
interface RetryConfig {
  maxRetries: number
  baseDelay: number // milliseconds
  maxDelay: number // milliseconds
  backoffMultiplier: number
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
}

/**
 * Webhook event processing status
 */
enum WebhookEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

/**
 * Enhanced webhook handler with retry logic and comprehensive logging
 */
export class WebhookHandler {
  private stripe: Stripe
  private retryConfig: RetryConfig

  constructor(stripe: Stripe, retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.stripe = stripe
    this.retryConfig = retryConfig
  }

  /**
   * Process webhook with comprehensive error handling and retry logic
   */
  async processWebhook(
    signature: string,
    payload: Buffer,
    webhookSecret: string,
    clientIP?: string
  ): Promise<WebhookProcessingResult> {
    let event: Stripe.Event
    let eventId = 'unknown'
    let eventType = 'unknown'

    try {
      // Verify webhook signature
      try {
        event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret)
        eventId = event.id
        eventType = event.type
      } catch (error) {
        const webhookError = createWebhookSignatureError(signature, eventId)
        
        // Log signature verification failure
        await this.logWebhookEvent(eventId, eventType, WebhookEventStatus.FAILED, {
          error: webhookError.message,
          signature,
          clientIP,
          payloadSize: payload.length
        })

        // Handle the error through error handler
        await errorHandler.handleError(webhookError, {
          action: 'webhook_signature_verification',
          endpoint: '/api/webhooks/stripe',
          method: 'POST',
          ip: clientIP,
          additionalMetadata: { signature, payloadSize: payload.length }
        })

        return {
          success: false,
          eventId,
          eventType,
          processed: false,
          error: webhookError.getUserMessage()
        }
      }

      // Log webhook received
      await this.logWebhookEvent(eventId, eventType, WebhookEventStatus.PENDING, {
        clientIP,
        payloadSize: payload.length
      })

      // Check if event was already processed
      const existingEvent = await this.getWebhookEventRecord(eventId)
      if (existingEvent && existingEvent.status === WebhookEventStatus.COMPLETED) {
        await this.logWebhookEvent(eventId, eventType, WebhookEventStatus.COMPLETED, {
          message: 'Event already processed (idempotent)',
          previousProcessedAt: existingEvent.processedAt
        })

        return {
          success: true,
          eventId,
          eventType,
          processed: true
        }
      }

      // Process the event with retry logic
      const result = await this.processEventWithRetry(event)
      
      return result

    } catch (error) {
      // Handle unexpected errors
      const webhookError = createWebhookProcessingError(
        eventType,
        eventId,
        error instanceof Error ? error : new Error(String(error))
      )

      await this.logWebhookEvent(eventId, eventType, WebhookEventStatus.FAILED, {
        error: webhookError.message,
        stack: error instanceof Error ? error.stack : undefined
      })

      await errorHandler.handleError(webhookError, {
        action: 'webhook_processing',
        endpoint: '/api/webhooks/stripe',
        method: 'POST',
        ip: clientIP,
        additionalMetadata: { eventId, eventType }
      })

      return {
        success: false,
        eventId,
        eventType,
        processed: false,
        error: webhookError.getUserMessage()
      }
    }
  }

  /**
   * Process event with retry logic
   */
  private async processEventWithRetry(event: Stripe.Event): Promise<WebhookProcessingResult> {
    let lastError: Error | null = null
    let retryCount = 0

    // Update status to processing
    await this.updateWebhookEventStatus(event.id, WebhookEventStatus.PROCESSING)

    while (retryCount <= this.retryConfig.maxRetries) {
      try {
        // Process the actual event
        await this.processStripeEvent(event)

        // Mark as completed
        await this.updateWebhookEventStatus(event.id, WebhookEventStatus.COMPLETED)

        await this.logWebhookEvent(event.id, event.type, WebhookEventStatus.COMPLETED, {
          retryCount: retryCount > 0 ? retryCount : undefined,
          processingTime: Date.now()
        })

        return {
          success: true,
          eventId: event.id,
          eventType: event.type,
          processed: true,
          retryCount: retryCount > 0 ? retryCount : undefined
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        retryCount++

        // Log retry attempt
        await this.logWebhookEvent(event.id, event.type, WebhookEventStatus.RETRYING, {
          retryCount,
          error: lastError.message,
          nextRetryIn: retryCount <= this.retryConfig.maxRetries ? this.calculateDelay(retryCount) : undefined
        })

        // If we've exhausted retries, fail
        if (retryCount > this.retryConfig.maxRetries) {
          await this.updateWebhookEventStatus(event.id, WebhookEventStatus.FAILED)
          
          const webhookError = createWebhookProcessingError(event.type, event.id, lastError)
          
          await errorHandler.handleError(webhookError, {
            action: 'webhook_processing_final_failure',
            endpoint: '/api/webhooks/stripe',
            method: 'POST',
            additionalMetadata: { 
              eventId: event.id, 
              eventType: event.type, 
              retryCount,
              finalError: lastError.message
            }
          })

          return {
            success: false,
            eventId: event.id,
            eventType: event.type,
            processed: false,
            retryCount,
            error: webhookError.getUserMessage()
          }
        }

        // Wait before retry
        const delay = this.calculateDelay(retryCount)
        await this.sleep(delay)
      }
    }

    // This should never be reached, but just in case
    return {
      success: false,
      eventId: event.id,
      eventType: event.type,
      processed: false,
      retryCount,
      error: lastError?.message || 'Unknown error'
    }
  }

  /**
   * Process individual Stripe event
   */
  private async processStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case "customer.subscription.created":
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.trial_will_end":
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription)
        break

      case "invoice.payment_succeeded":
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case "invoice.payment_failed":
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case "customer.updated":
        await this.handleCustomerUpdated(event.data.object as Stripe.Customer)
        break

      case "payment_method.attached":
        await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod)
        break

      case "setup_intent.succeeded":
        await this.handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
        break

      default:
        // Log unhandled event types for monitoring
        await this.logWebhookEvent(event.id, event.type, WebhookEventStatus.COMPLETED, {
          message: 'Unhandled event type - no processing required',
          eventData: JSON.stringify(event.data.object).substring(0, 500)
        })
    }
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organizationId

    if (!organizationId) {
      throw new Error("Organization ID not found in session metadata")
    }

    // Get subscription details if available
    let subscriptionData: any = {}
    if (session.subscription) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string)
        subscriptionData = {
          subscriptionStatus: subscription.status,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        }

        // Handle trial period
        if (subscription.trial_end) {
          subscriptionData.trialStartDate = new Date()
          subscriptionData.trialEndDate = new Date(subscription.trial_end * 1000)
          subscriptionData.trialUsed = true
        }
      } catch (error) {
        // Log but don't fail the webhook
        await auditLogger.logSystemError(
          undefined,
          error instanceof Error ? error : new Error(String(error)),
          'fetch_subscription_details',
          { organizationId, sessionId: session.id }
        )
      }
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: 'PRO',
        stripeSubscriptionId: session.subscription as string,
        stripeCustomerId: session.customer as string,
        ...subscriptionData,
      },
    })

    // Log successful processing
    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'checkout_session_completed',
        context: 'stripe_webhook',
        organizationId,
        sessionId: session.id,
        subscriptionId: session.subscription
      }
    })
  }

  /**
   * Handle subscription created
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organizationId

    if (!organizationId) {
      // Try to find organization by customer ID
      const organization = await prisma.organization.findFirst({
        where: { stripeCustomerId: subscription.customer as string }
      })

      if (!organization) {
        throw new Error(`Organization not found for subscription: ${subscription.id}`)
      }
    }

    const updateData: any = {
      plan: 'PRO',
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      subscriptionStatus: subscription.status,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    }

    // Handle trial period
    if (subscription.trial_end) {
      updateData.trialStartDate = new Date()
      updateData.trialEndDate = new Date(subscription.trial_end * 1000)
      updateData.trialUsed = true
    }

    const targetOrganizationId = organizationId || (await prisma.organization.findFirst({
      where: { stripeCustomerId: subscription.customer as string }
    }))?.id

    if (!targetOrganizationId) {
      throw new Error(`Cannot find organization for subscription: ${subscription.id}`)
    }

    await prisma.organization.update({
      where: { id: targetOrganizationId },
      data: updateData,
    })

    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'subscription_created',
        context: 'stripe_webhook',
        organizationId: targetOrganizationId,
        subscriptionId: subscription.id
      }
    })
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const organization = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!organization) {
      throw new Error(`Organization not found for subscription: ${subscription.id}`)
    }

    const updateData: any = {
      subscriptionStatus: subscription.status,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    }

    // Update trial information if present
    if (subscription.trial_end) {
      updateData.trialEndDate = new Date(subscription.trial_end * 1000)
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: updateData,
    })

    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'subscription_updated',
        context: 'stripe_webhook',
        organizationId: organization.id,
        subscriptionId: subscription.id
      }
    })
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const organization = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!organization) {
      throw new Error(`Organization not found for subscription: ${subscription.id}`)
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        plan: 'FREE',
        stripeSubscriptionId: null,
        subscriptionStatus: 'canceled',
        cancelAtPeriodEnd: false,
      },
    })

    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'subscription_deleted',
        context: 'stripe_webhook',
        organizationId: organization.id,
        subscriptionId: subscription.id
      }
    })
  }

  /**
   * Handle trial will end
   */
  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    const organization = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!organization) {
      throw new Error(`Organization not found for subscription: ${subscription.id}`)
    }

    // Update trial end date if needed
    if (subscription.trial_end) {
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          trialEndDate: new Date(subscription.trial_end * 1000),
        },
      })
    }

    // Here you could trigger notifications to the user
    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'trial_will_end',
        context: 'stripe_webhook',
        organizationId: organization.id,
        subscriptionId: subscription.id,
        trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      }
    })
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!(invoice as any).subscription) {
      return // Not a subscription invoice
    }

    const organization = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: (invoice as any).subscription as string },
    })

    if (!organization) {
      throw new Error(`Organization not found for subscription: ${(invoice as any).subscription}`)
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        lastPaymentDate: new Date((invoice as any).status_transitions.paid_at! * 1000),
        subscriptionStatus: 'active',
      },
    })

    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'payment_succeeded',
        context: 'stripe_webhook',
        organizationId: organization.id,
        subscriptionId: (invoice as any).subscription,
        invoiceId: invoice.id,
        amount: (invoice as any).amount_paid
      }
    })
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!(invoice as any).subscription) {
      return // Not a subscription invoice
    }

    const organization = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: (invoice as any).subscription as string },
    })

    if (!organization) {
      throw new Error(`Organization not found for subscription: ${(invoice as any).subscription}`)
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        subscriptionStatus: 'past_due',
      },
    })

    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'payment_failed',
        context: 'stripe_webhook',
        organizationId: organization.id,
        subscriptionId: (invoice as any).subscription,
        invoiceId: invoice.id,
        amount: (invoice as any).amount_due,
        failureReason: (invoice as any).last_finalization_error?.message
      }
    })
  }

  /**
   * Handle customer updated (often triggered by portal changes)
   */
  private async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    const organization = await prisma.organization.findFirst({
      where: { stripeCustomerId: customer.id }
    })

    if (!organization) {
      // Log but don't fail - customer might not be associated with an organization yet
      await this.logWebhookEvent(customer.id, 'customer_updated', WebhookEventStatus.COMPLETED, {
        message: 'Customer not found in database - might be new customer',
        customerId: customer.id
      })
      return
    }

    // Log customer update for portal activity tracking
    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'customer_updated',
        context: 'stripe_webhook',
        organizationId: organization.id,
        customerId: customer.id,
        customerEmail: customer.email,
        portalActivity: true // Flag this as potential portal activity
      }
    })

    // Trigger subscription data sync if customer has active subscription
    if (organization.stripeSubscriptionId) {
      await this.syncSubscriptionData(organization.id, organization.stripeSubscriptionId)
    }
  }

  /**
   * Handle payment method attached (often from portal)
   */
  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    if (!paymentMethod.customer) {
      return // No customer associated
    }

    const organization = await prisma.organization.findFirst({
      where: { stripeCustomerId: paymentMethod.customer as string }
    })

    if (!organization) {
      return // Customer not found
    }

    // Update payment method information if this is the default payment method
    if (paymentMethod.card && organization.stripeSubscriptionId) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(organization.stripeSubscriptionId)
        
        // Check if this payment method is now the default
        if (subscription.default_payment_method === paymentMethod.id) {
          await prisma.organization.update({
            where: { id: organization.id },
            data: {
              paymentMethodLast4: paymentMethod.card.last4,
              paymentMethodBrand: paymentMethod.card.brand,
            },
          })

          await Promise.all([
            auditLogger.logEvent('webhook_processed', {
              userId: undefined,
              metadata: {
                eventType: 'payment_method_attached',
                context: 'stripe_webhook',
                organizationId: organization.id,
                paymentMethodId: paymentMethod.id,
                last4: paymentMethod.card.last4,
                brand: paymentMethod.card.brand,
                portalActivity: true
              }
            }),
            trackPortalAction(organization.id, undefined, 'payment_method_updated', {
              paymentMethodId: paymentMethod.id,
              last4: paymentMethod.card.last4,
              brand: paymentMethod.card.brand
            })
          ])
        }
      } catch (error) {
        // Log error but don't fail webhook
        await auditLogger.logSystemError(
          undefined,
          error instanceof Error ? error : new Error(String(error)),
          'sync_payment_method',
          { organizationId: organization.id, paymentMethodId: paymentMethod.id }
        )
      }
    }
  }

  /**
   * Handle setup intent succeeded (payment method setup from portal)
   */
  private async handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent): Promise<void> {
    if (!setupIntent.customer || !setupIntent.payment_method) {
      return
    }

    const organization = await prisma.organization.findFirst({
      where: { stripeCustomerId: setupIntent.customer as string }
    })

    if (!organization) {
      return
    }

    // Log setup intent success for portal activity tracking
    await auditLogger.logEvent('webhook_processed', {
      userId: undefined,
      metadata: {
        eventType: 'setup_intent_succeeded',
        context: 'stripe_webhook',
        organizationId: organization.id,
        setupIntentId: setupIntent.id,
        paymentMethodId: setupIntent.payment_method,
        portalActivity: true
      }
    })

    // Trigger subscription data sync to update payment method info
    if (organization.stripeSubscriptionId) {
      await this.syncSubscriptionData(organization.id, organization.stripeSubscriptionId)
    }
  }

  /**
   * Sync subscription data from Stripe (used for portal changes)
   */
  private async syncSubscriptionData(organizationId: string, subscriptionId: string): Promise<void> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'latest_invoice']
      })

      const updateData: any = {
        subscriptionStatus: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      }

      // Update trial information if present
      if (subscription.trial_end) {
        updateData.trialEndDate = new Date(subscription.trial_end * 1000)
      }

      // Update payment method information
      if (subscription.default_payment_method && typeof subscription.default_payment_method === 'object') {
        const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod
        if (paymentMethod.card) {
          updateData.paymentMethodLast4 = paymentMethod.card.last4
          updateData.paymentMethodBrand = paymentMethod.card.brand
        }
      }

      // Update next billing date
      if (subscription.status === 'active' && !subscription.cancel_at_period_end) {
        updateData.nextBillingDate = new Date((subscription as any).current_period_end * 1000)
      }

      await prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
      })

      await auditLogger.logEvent('subscription_synced', {
        userId: undefined,
        metadata: {
          organizationId,
          subscriptionId,
          syncedFields: Object.keys(updateData),
          context: 'webhook_portal_sync',
          syncReason: 'portal_activity'
        }
      })

    } catch (error) {
      await auditLogger.logSystemError(
        undefined,
        error instanceof Error ? error : new Error(String(error)),
        'sync_subscription_data',
        { organizationId, subscriptionId }
      )
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateDelay(retryCount: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1),
      this.retryConfig.maxDelay
    )
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay
    return Math.floor(delay + jitter)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Log webhook event
   */
  private async logWebhookEvent(
    eventId: string,
    eventType: string,
    status: WebhookEventStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await auditLogger.logEvent('webhook_processed', {
        userId: undefined,
        metadata: {
          eventId,
          eventType,
          status,
          timestamp: new Date().toISOString(),
          context: 'stripe_webhook',
          ...metadata
        }
      })
    } catch (error) {
      // Don't fail webhook processing due to logging errors
      console.error('Failed to log webhook event:', error)
    }
  }

  /**
   * Get webhook event record from database
   */
  private async getWebhookEventRecord(eventId: string): Promise<any> {
    // This would typically query a webhook_events table
    // For now, we'll use a simple in-memory approach or skip
    // In production, you'd want to store webhook processing status
    return null
  }

  /**
   * Update webhook event status
   */
  private async updateWebhookEventStatus(eventId: string, status: WebhookEventStatus): Promise<void> {
    // This would typically update a webhook_events table
    // For now, we'll just log the status change
    await this.logWebhookEvent(eventId, 'status_update', status as WebhookEventStatus, { newStatus: status })
  }
}

// Export singleton instance
export const webhookHandler = new WebhookHandler(
  new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-08-27.basil",
  })
)