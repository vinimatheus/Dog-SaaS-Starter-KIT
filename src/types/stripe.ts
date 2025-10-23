/**
 * TypeScript interfaces for Stripe integration, trial management, and subscription data
 */

/**
 * Interface representing the trial status of an organization
 */
export interface TrialStatus {
  /** Whether the organization is currently in a trial period */
  isInTrial: boolean;
  /** Date when the trial started */
  trialStartDate: Date | null;
  /** Date when the trial ends/ended */
  trialEndDate: Date | null;
  /** Number of days remaining in the trial (0 if expired or not in trial) */
  daysRemaining: number;
  /** Whether the organization has already used their trial */
  hasUsedTrial: boolean;
}

/**
 * Interface representing comprehensive subscription details
 */
export interface SubscriptionDetails {
  /** Current subscription status */
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | null;
  /** Start date of the current billing period */
  currentPeriodStart: Date | null;
  /** End date of the current billing period */
  currentPeriodEnd: Date | null;
  /** Whether the subscription will be canceled at the end of the current period */
  cancelAtPeriodEnd: boolean;
  /** Date when the trial ends (null if not in trial) */
  trialEnd: Date | null;
  /** Date of the last successful payment */
  lastPaymentDate: Date | null;
  /** Date of the next billing cycle */
  nextBillingDate: Date | null;
  /** Payment method information */
  paymentMethod: {
    /** Last 4 digits of the payment method */
    last4: string;
    /** Brand of the payment method (visa, mastercard, etc.) */
    brand: string;
    /** Expiry month of the payment method */
    expiryMonth: number;
    /** Expiry year of the payment method */
    expiryYear: number;
  } | null;
  /** Information about the upcoming invoice */
  upcomingInvoice: {
    /** Amount to be charged in cents */
    amount: number;
    /** Currency of the charge */
    currency: string;
    /** Date when the invoice will be charged */
    date: Date;
  } | null;
}

/**
 * Configuration interface for Stripe products and pricing
 */
export interface StripeProducts {
  PRO_MONTHLY: {
    /** Stripe price ID for the Pro monthly plan */
    priceId: string;
    /** Number of trial days for new subscriptions */
    trialPeriodDays: number;
    /** List of features included in this plan */
    features: string[];
    /** Display name for the plan */
    displayName: string;
    /** Price in cents */
    priceInCents: number;
    /** Currency code */
    currency: string;
  };
}

/**
 * Interface for trial eligibility check result
 */
export interface TrialEligibility {
  /** Whether the organization is eligible for a trial */
  isEligible: boolean;
  /** Reason for ineligibility (if applicable) */
  reason?: 'already_used' | 'already_subscribed' | 'invalid_organization';
  /** Additional context message */
  message?: string;
}

/**
 * Interface for trial calculation result
 */
export interface TrialCalculation {
  /** Whether the trial is currently active */
  isActive: boolean;
  /** Number of days remaining (can be negative if expired) */
  daysRemaining: number;
  /** Whether the trial has expired */
  isExpired: boolean;
  /** Total trial duration in days */
  totalDays: number;
  /** Number of days elapsed since trial start */
  daysElapsed: number;
}

/**
 * Webhook event types that the application handles
 */
export const STRIPE_WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'checkout.session.completed'
] as const;

export type StripeWebhookEvent = typeof STRIPE_WEBHOOK_EVENTS[number];

/**
 * Configuration for required Stripe webhooks
 */
export interface StripeWebhookConfig {
  /** List of required webhook events */
  requiredEvents: readonly StripeWebhookEvent[];
  /** Webhook endpoint URL */
  endpointUrl: string;
  /** Whether to enable webhook signature verification */
  enableSignatureVerification: boolean;
}