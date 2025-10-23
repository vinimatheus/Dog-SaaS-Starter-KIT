"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import Stripe from "stripe"
import { PlanType } from "@prisma/client"
import { stripe } from "@/lib/stripe"
import { permissionManager } from "@/lib/permission-manager"
import { checkTrialEligibility, calculateTrialEndDate, TRIAL_DURATION_DAYS, getTrialStatus } from "@/lib/trial-utils"
import { TrialStatus, SubscriptionDetails } from "@/types/stripe"
import {
  TrialAlreadyUsedError,
  TrialNotEligibleError,
  SubscriptionAlreadyExistsError,
  SubscriptionNotFoundError,
  StripeApiError,
  createTrialAlreadyUsedError,
  createTrialNotEligibleError,
  createSubscriptionAlreadyExistsError,
  createSubscriptionNotFoundError,
  createStripeApiError
} from "@/lib/errors/stripe-errors"
import { OrganizationNotFoundError } from "@/lib/errors"
import { auditLogger } from "@/lib/audit-logger"
import { trackPortalSessionStart, trackPortalSessionEnd } from "@/lib/portal-activity-logger"

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
})

export async function createCheckoutSession(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId, session.user.id)
  }

  // Use PermissionManager to check subscription management permissions
  const canManageSubscription = await permissionManager.canManageSubscription(session.user.id, organizationId, {
    logFailure: true,
    context: "createCheckoutSession"
  })

  if (!canManageSubscription) {
    throw new Error("Apenas o dono pode gerenciar a assinatura")
  }

  if (organization.plan === "PRO") {
    throw new SubscriptionAlreadyExistsError(organizationId, organization.stripeSubscriptionId || 'unknown', session.user.id)
  }

  if (organization.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: organization.stripeCustomerId,
        status: "active",
        price: process.env.STRIPE_PRO_PLAN_PRICE_ID,
      })

      if (subscriptions.data.length > 0) {
        throw createSubscriptionAlreadyExistsError(organizationId, subscriptions.data[0].id, session.user.id)
      }
    } catch (error: any) {
      if (error instanceof SubscriptionAlreadyExistsError) {
        throw error
      }
      throw createStripeApiError('list_subscriptions', error, session.user.id, organizationId)
    }
  }

  // Check trial eligibility
  const trialEligibility = checkTrialEligibility(organization)
  
  if (!trialEligibility.isEligible && trialEligibility.reason) {
    throw createTrialNotEligibleError(organizationId, trialEligibility.reason, session.user.id)
  }
  
  // Create checkout session with trial support
  const checkoutSessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: process.env.STRIPE_PRO_PLAN_PRICE_ID,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${organization.uniqueId}/config/subscription?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${organization.uniqueId}/config/subscription`,
    metadata: {
      organizationId: organization.id,
      trialEligible: trialEligibility.isEligible.toString(),
      trialDuration: TRIAL_DURATION_DAYS.toString(),
    },
  }

  // Add trial period if eligible
  if (trialEligibility.isEligible) {
    checkoutSessionParams.subscription_data = {
      trial_period_days: TRIAL_DURATION_DAYS,
      metadata: {
        organizationId: organization.id,
        trialStarted: "true",
      }
    }
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create(checkoutSessionParams)
    return { url: checkoutSession.url }
  } catch (error: any) {
    throw createStripeApiError('create_checkout_session', error, session.user.id, organizationId)
  }
}

export async function createCustomerPortalSession(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId, session.user.id)
  }

  // Use PermissionManager to check subscription management permissions
  const canManageSubscription = await permissionManager.canManageSubscription(session.user.id, organizationId, {
    logFailure: true,
    context: "createCustomerPortalSession"
  })

  if (!canManageSubscription) {
    throw new Error("Apenas o dono pode gerenciar a assinatura")
  }

  if (!organization.stripeCustomerId) {
    throw new Error("Organização não possui um ID de cliente do Stripe")
  }

  try {
    // Get trial status to determine portal configuration
    const trialStatus = getTrialStatus(organization)
    
    // Create portal session with trial-aware configuration
    const portalSessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: organization.stripeCustomerId!,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/${organization.uniqueId}/config/subscription?portal_return=true`,
    }

    // Configure portal based on trial status and subscription state
    if (organization.stripeSubscriptionId) {
      // If there's an active subscription, allow full portal access
      portalSessionParams.configuration = await getOrCreatePortalConfiguration(trialStatus.isInTrial)
    } else {
      // If no subscription yet, limit portal functionality
      portalSessionParams.configuration = await getOrCreatePortalConfiguration(false, true)
    }

    const portalSession = await stripe.billingPortal.sessions.create(portalSessionParams)

    // Log portal access for audit and activity tracking
    await Promise.all([
      auditLogger.logEvent('customer_portal_accessed', {
        userId: session.user.id,
        metadata: {
          organizationId,
          portalSessionId: portalSession.id,
          isInTrial: trialStatus.isInTrial,
          hasSubscription: !!organization.stripeSubscriptionId,
          context: 'customer_portal_session_created'
        }
      }),
      trackPortalSessionStart(organizationId, session.user.id, portalSession.id, {
        isInTrial: trialStatus.isInTrial,
        hasSubscription: !!organization.stripeSubscriptionId
      })
    ])

    return { url: portalSession.url }
  } catch (error: any) {
    throw createStripeApiError('create_portal_session', error, session.user.id, organizationId)
  }
}

export async function handleStripeWebhookAction(
  signature: string,
  payload: Buffer,
  webhookSecret: string
) {
  try {
    console.log("Processando webhook com signature:", signature)
    
    const event = stripeInstance.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    )

    console.log("Evento recebido:", event.type)

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        console.log("Sessão de checkout completada:", session)
        
        const organizationId = session.metadata?.organizationId

        if (!organizationId) {
          console.error("Organization ID não encontrado na sessão:", session)
          throw new Error("Organization ID não encontrado")
        }

        console.log("Atualizando organização:", organizationId)

        // Get subscription details to check if it has a trial
        let subscriptionData: any = {}
        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
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
            console.error("Error fetching subscription details:", error)
          }
        }

        const updatedOrg = await prisma.organization.update({
          where: { id: organizationId },
          data: {
            plan: PlanType.PRO,
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            ...subscriptionData,
          },
        })

        console.log("Organização atualizada:", updatedOrg)

        const script = `
          <script>
            window.onload = function() {
              if (typeof confetti !== 'undefined') {
                confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 }
                });
              }
            }
          </script>
        `;

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Assinatura Concluída</title>
              <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
              ${script}
            </head>
            <body>
              <h1>Assinatura Concluída com Sucesso!</h1>
              <p>Você será redirecionado em instantes...</p>
            </body>
          </html>
        `;

        return new Response(html, {
          headers: {
            'Content-Type': 'text/html',
          },
        });
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription
        console.log("Assinatura criada:", subscription)

        const organizationId = subscription.metadata?.organizationId

        if (organizationId) {
          const updateData: any = {
            plan: PlanType.PRO,
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

          await prisma.organization.update({
            where: { id: organizationId },
            data: updateData,
          })

          console.log("Organização atualizada com nova assinatura:", organizationId)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        console.log("Assinatura atualizada:", subscription)

        const organization = await prisma.organization.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (organization) {
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

          console.log("Organização atualizada:", organization.id)
        }
        break
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription
        console.log("Trial prestes a expirar:", subscription)

        const organization = await prisma.organization.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (organization) {
          // Here you could send a notification to the user about trial ending
          console.log("Trial ending soon for organization:", organization.id)
          
          // Update trial end date if needed
          if (subscription.trial_end) {
            await prisma.organization.update({
              where: { id: organization.id },
              data: {
                trialEndDate: new Date(subscription.trial_end * 1000),
              },
            })
          }
        }
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        console.log("Pagamento bem-sucedido:", invoice)

        if ((invoice as any).subscription) {
          const organization = await prisma.organization.findFirst({
            where: { stripeSubscriptionId: (invoice as any).subscription as string },
          })

          if (organization) {
            await prisma.organization.update({
              where: { id: organization.id },
              data: {
                lastPaymentDate: new Date((invoice as any).status_transitions.paid_at! * 1000),
                subscriptionStatus: 'active',
              },
            })

            console.log("Pagamento registrado para organização:", organization.id)
          }
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        console.log("Falha no pagamento:", invoice)

        if ((invoice as any).subscription) {
          const organization = await prisma.organization.findFirst({
            where: { stripeSubscriptionId: (invoice as any).subscription as string },
          })

          if (organization) {
            await prisma.organization.update({
              where: { id: organization.id },
              data: {
                subscriptionStatus: 'past_due',
              },
            })

            console.log("Falha no pagamento registrada para organização:", organization.id)
          }
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        console.log("Assinatura cancelada:", subscription)

        const organization = await prisma.organization.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (organization) {
          console.log("Atualizando organização após cancelamento:", organization.id)
          
          const updatedOrg = await prisma.organization.update({
            where: { id: organization.id },
            data: {
              plan: PlanType.FREE,
              stripeSubscriptionId: null,
              subscriptionStatus: 'canceled',
              cancelAtPeriodEnd: false,
            },
          })

          console.log("Organização atualizada após cancelamento:", updatedOrg)
        }
        break
      }
    }

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Erro detalhado no webhook:", error)
    throw error
  }
}

export async function cancelSubscription(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId, session.user.id)
  }

  // Use PermissionManager to check subscription management permissions
  const canManageSubscription = await permissionManager.canManageSubscription(session.user.id, organizationId, {
    logFailure: true,
    context: "cancelSubscription"
  })

  if (!canManageSubscription) {
    throw new Error("Apenas o dono pode gerenciar a assinatura")
  }

  if (!organization.stripeSubscriptionId) {
    throw createSubscriptionNotFoundError(organizationId, session.user.id)
  }

  try {
    // Get current subscription to check trial status
    const subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId)
    
    // If subscription is in trial, cancel immediately
    // Otherwise, cancel at period end
    if (subscription.status === 'trialing') {
      await stripe.subscriptions.cancel(organization.stripeSubscriptionId)
      
      // Update organization immediately since trial is canceled
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          plan: PlanType.FREE,
          stripeSubscriptionId: null,
          subscriptionStatus: 'canceled',
          cancelAtPeriodEnd: false,
        },
      })
    } else {
      await stripe.subscriptions.update(organization.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })

      // Update organization to reflect cancellation at period end
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          cancelAtPeriodEnd: true,
        },
      })
    }

    return { success: true }
  } catch (error: any) {
    throw createStripeApiError('cancel_subscription', error, session.user.id, organizationId)
  }
}

export async function getTrialStatusAction(organizationId: string): Promise<TrialStatus> {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId, session.user.id)
  }

  // Use PermissionManager to check subscription management permissions
  const canManageSubscription = await permissionManager.canManageSubscription(session.user.id, organizationId, {
    logFailure: true,
    context: "getTrialStatus"
  })

  if (!canManageSubscription) {
    throw new Error("Apenas o dono pode visualizar informações da assinatura")
  }

  return getTrialStatus(organization)
}

export async function getSubscriptionDetailsAction(organizationId: string): Promise<SubscriptionDetails> {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId, session.user.id)
  }

  // Use PermissionManager to check subscription management permissions
  const canManageSubscription = await permissionManager.canManageSubscription(session.user.id, organizationId, {
    logFailure: true,
    context: "getSubscriptionDetails"
  })

  if (!canManageSubscription) {
    throw new Error("Apenas o dono pode visualizar informações da assinatura")
  }

  // Build subscription details from organization data
  const subscriptionDetails: SubscriptionDetails = {
    status: organization.subscriptionStatus as SubscriptionDetails['status'],
    currentPeriodStart: organization.currentPeriodStart,
    currentPeriodEnd: organization.currentPeriodEnd,
    cancelAtPeriodEnd: organization.cancelAtPeriodEnd,
    trialEnd: organization.trialEndDate,
    lastPaymentDate: organization.lastPaymentDate,
    nextBillingDate: organization.nextBillingDate,
    paymentMethod: organization.paymentMethodLast4 && organization.paymentMethodBrand ? {
      last4: organization.paymentMethodLast4,
      brand: organization.paymentMethodBrand,
      expiryMonth: 0, // Will be updated from Stripe data
      expiryYear: 0   // Will be updated from Stripe data
    } : null,
    upcomingInvoice: null // Will be populated from Stripe data
  }

  // If we have a Stripe subscription, fetch additional details
  if (organization.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId, {
        expand: ['default_payment_method', 'latest_invoice']
      })

      // Update subscription details with Stripe data
      subscriptionDetails.status = subscription.status as SubscriptionDetails['status']
      subscriptionDetails.currentPeriodStart = new Date((subscription as any).current_period_start * 1000)
      subscriptionDetails.currentPeriodEnd = new Date((subscription as any).current_period_end * 1000)
      subscriptionDetails.cancelAtPeriodEnd = (subscription as any).cancel_at_period_end
      subscriptionDetails.trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null

      // Get payment method details
      if (subscription.default_payment_method && typeof subscription.default_payment_method === 'object') {
        const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod
        if (paymentMethod.card) {
          subscriptionDetails.paymentMethod = {
            last4: paymentMethod.card.last4,
            brand: paymentMethod.card.brand,
            expiryMonth: paymentMethod.card.exp_month,
            expiryYear: paymentMethod.card.exp_year
          }
        }
      }

      // Get upcoming invoice
      try {
        const upcomingInvoice = await stripe.invoices.list({
          customer: organization.stripeCustomerId!,
          limit: 1,
          status: 'draft'
        })

        if (upcomingInvoice.data.length > 0) {
          const invoice = upcomingInvoice.data[0]
          subscriptionDetails.upcomingInvoice = {
            amount: (invoice as any).amount_due || 0,
            currency: invoice.currency || 'usd',
            date: new Date((invoice as any).period_end ? (invoice as any).period_end * 1000 : Date.now())
          }
        }
      } catch (error) {
        // Upcoming invoice might not exist, that's okay
        console.log("No upcoming invoice found:", error)
      }

    } catch (error: any) {
      // Log the error but continue with database data
      throw createStripeApiError('retrieve_subscription_details', error, session.user.id, organizationId)
    }
  }

  return subscriptionDetails
}

/**
 * Get or create a Stripe billing portal configuration optimized for trial subscriptions
 */
async function getOrCreatePortalConfiguration(isInTrial: boolean, limitedAccess: boolean = false): Promise<string | undefined> {
  try {
    // List existing configurations to see if we have one that matches our needs
    const configurations = await stripe.billingPortal.configurations.list({ limit: 10 })
    
    // Look for existing configuration that matches our requirements
    const configName = isInTrial ? 'trial-aware-config' : (limitedAccess ? 'limited-access-config' : 'standard-config')
    const existingConfig = configurations.data.find(config => 
      config.metadata?.configType === configName
    )

    if (existingConfig) {
      return existingConfig.id
    }

    // Create new configuration if none exists
    const configParams: Stripe.BillingPortal.ConfigurationCreateParams = {
      business_profile: {
        headline: 'Gerencie sua assinatura',
        privacy_policy_url: `${process.env.NEXT_PUBLIC_APP_URL}/privacy`,
        terms_of_service_url: `${process.env.NEXT_PUBLIC_APP_URL}/terms`,
      },
      features: {
        payment_method_update: {
          enabled: !limitedAccess,
        },
        invoice_history: {
          enabled: true,
        },
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'address', 'phone', 'tax_id'],
        },
      },
      metadata: {
        configType: configName,
        createdAt: new Date().toISOString(),
      },
    }

    // Configure subscription management based on trial status
    if (!limitedAccess) {
      configParams.features!.subscription_update = {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
      }

      configParams.features!.subscription_cancel = {
        enabled: true,
        mode: isInTrial ? 'immediately' : 'at_period_end',
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
      }
    }

    const newConfig = await stripe.billingPortal.configurations.create(configParams)
    return newConfig.id

  } catch (error) {
    // If configuration creation fails, return undefined to use default
    console.error('Failed to create portal configuration:', error)
    return undefined
  }
}

/**
 * Handle return from customer portal and sync any changes
 */
export async function handlePortalReturn(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId, session.user.id)
  }

  // Use PermissionManager to check subscription management permissions
  const canManageSubscription = await permissionManager.canManageSubscription(session.user.id, organizationId, {
    logFailure: true,
    context: "handlePortalReturn"
  })

  if (!canManageSubscription) {
    throw new Error("Apenas o dono pode gerenciar a assinatura")
  }

  try {
    // Force sync subscription data from Stripe
    if (organization.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId, {
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

      // Log portal return and sync
      await Promise.all([
        auditLogger.logEvent('customer_portal_return', {
          userId: session.user.id,
          metadata: {
            organizationId,
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            syncedFields: Object.keys(updateData),
            context: 'portal_return_sync'
          }
        }),
        trackPortalSessionEnd(organizationId, session.user.id, {
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          syncedFields: Object.keys(updateData)
        })
      ])
    }

    return { success: true }
  } catch (error: any) {
    throw createStripeApiError('portal_return_sync', error, session.user.id, organizationId)
  }
}