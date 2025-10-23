// Stripe and trial-specific error classes
import { OrganizationError, BusinessLogicError, SystemError } from "./index"

/**
 * Base class for all Stripe-related errors
 */
export abstract class StripeError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, metadata)
  }

  getSeverity(): 'medium' | 'high' {
    return 'medium'
  }

  shouldAlert(): boolean {
    return this.getSeverity() === 'high'
  }
}

/**
 * Trial-specific errors
 */
export class TrialError extends StripeError {
  constructor(
    message: string,
    code: 'TRIAL_ALREADY_USED' | 'TRIAL_EXPIRED' | 'INVALID_TRIAL_STATE' | 'TRIAL_NOT_ELIGIBLE',
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, metadata)
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'TRIAL_ALREADY_USED':
        return "Esta organização já utilizou o período de teste gratuito."
      case 'TRIAL_EXPIRED':
        return "O período de teste gratuito expirou."
      case 'INVALID_TRIAL_STATE':
        return "Estado do período de teste inválido."
      case 'TRIAL_NOT_ELIGIBLE':
        return "Esta organização não é elegível para o período de teste."
      default:
        return "Erro relacionado ao período de teste."
    }
  }

  getSeverity(): 'medium' {
    return 'medium'
  }

  shouldAlert(): boolean {
    // Only alert for invalid trial states as they might indicate system issues
    return this.code === 'INVALID_TRIAL_STATE'
  }
}

/**
 * Trial already used error
 */
export class TrialAlreadyUsedError extends TrialError {
  constructor(organizationId: string, userId?: string) {
    super(
      `Trial already used for organization: ${organizationId}`,
      'TRIAL_ALREADY_USED',
      userId,
      organizationId,
      { trialUsed: true }
    )
  }
}

/**
 * Trial expired error
 */
export class TrialExpiredError extends TrialError {
  constructor(
    organizationId: string,
    trialEndDate: Date,
    userId?: string
  ) {
    super(
      `Trial expired for organization: ${organizationId} on ${trialEndDate.toISOString()}`,
      'TRIAL_EXPIRED',
      userId,
      organizationId,
      { trialEndDate: trialEndDate.toISOString() }
    )
  }
}

/**
 * Trial not eligible error
 */
export class TrialNotEligibleError extends TrialError {
  constructor(
    organizationId: string,
    reason: string,
    userId?: string
  ) {
    super(
      `Organization ${organizationId} not eligible for trial: ${reason}`,
      'TRIAL_NOT_ELIGIBLE',
      userId,
      organizationId,
      { reason }
    )
  }
}

/**
 * Invalid trial state error
 */
export class InvalidTrialStateError extends StripeError {
  constructor(
    organizationId: string,
    currentState: string,
    expectedState: string,
    userId?: string
  ) {
    super(
      `Invalid trial state for organization ${organizationId}: expected ${expectedState}, got ${currentState}`,
      'INVALID_TRIAL_STATE',
      userId,
      organizationId,
      { currentState, expectedState }
    )
  }

  getUserMessage(): string {
    return "Estado do período de teste inválido."
  }

  getSeverity(): 'high' {
    return 'high'
  }

  shouldAlert(): boolean {
    return true
  }
}

/**
 * Subscription-related errors
 */
export class SubscriptionError extends StripeError {
  constructor(
    message: string,
    code: string,
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, metadata)
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'SUBSCRIPTION_NOT_FOUND':
        return "Assinatura não encontrada."
      case 'SUBSCRIPTION_ALREADY_EXISTS':
        return "Já existe uma assinatura ativa para esta organização."
      case 'SUBSCRIPTION_CANCELED':
        return "A assinatura foi cancelada."
      case 'SUBSCRIPTION_PAST_DUE':
        return "A assinatura está em atraso. Atualize seu método de pagamento."
      case 'INVALID_SUBSCRIPTION_STATE':
        return "Estado da assinatura inválido."
      default:
        return "Erro relacionado à assinatura."
    }
  }
}

/**
 * Subscription not found error
 */
export class SubscriptionNotFoundError extends SubscriptionError {
  constructor(organizationId: string, userId?: string) {
    super(
      `Subscription not found for organization: ${organizationId}`,
      'SUBSCRIPTION_NOT_FOUND',
      userId,
      organizationId
    )
  }
}

/**
 * Subscription already exists error
 */
export class SubscriptionAlreadyExistsError extends SubscriptionError {
  constructor(organizationId: string, subscriptionId: string, userId?: string) {
    super(
      `Subscription already exists for organization: ${organizationId}`,
      'SUBSCRIPTION_ALREADY_EXISTS',
      userId,
      organizationId,
      { existingSubscriptionId: subscriptionId }
    )
  }
}

/**
 * Payment-related errors
 */
export class PaymentError extends StripeError {
  constructor(
    message: string,
    code: string,
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, metadata)
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'PAYMENT_FAILED':
        return "Falha no processamento do pagamento. Verifique seu método de pagamento."
      case 'PAYMENT_METHOD_REQUIRED':
        return "Método de pagamento obrigatório."
      case 'INSUFFICIENT_FUNDS':
        return "Fundos insuficientes. Verifique seu método de pagamento."
      case 'CARD_DECLINED':
        return "Cartão recusado. Tente outro método de pagamento."
      default:
        return "Erro no processamento do pagamento."
    }
  }

  getSeverity(): 'high' {
    return 'high'
  }

  shouldAlert(): boolean {
    // Alert for repeated payment failures
    return true
  }
}

/**
 * Payment failed error
 */
export class PaymentFailedError extends PaymentError {
  constructor(
    organizationId: string,
    paymentIntentId: string,
    reason: string,
    userId?: string
  ) {
    super(
      `Payment failed for organization ${organizationId}: ${reason}`,
      'PAYMENT_FAILED',
      userId,
      organizationId,
      { paymentIntentId, reason }
    )
  }
}

/**
 * Webhook processing errors
 */
export class WebhookError extends StripeError {
  constructor(
    message: string,
    code: string,
    webhookEventId?: string,
    userId?: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, userId, organizationId, { webhookEventId, ...metadata })
  }

  getUserMessage(): string {
    return "Erro interno no processamento de eventos. Nossa equipe foi notificada."
  }

  getSeverity(): 'high' {
    return 'high'
  }

  shouldAlert(): boolean {
    return true
  }
}

/**
 * Webhook signature verification error
 */
export class WebhookSignatureError extends WebhookError {
  constructor(signature: string, webhookEventId?: string) {
    super(
      `Invalid webhook signature: ${signature}`,
      'WEBHOOK_SIGNATURE_INVALID',
      webhookEventId,
      undefined,
      undefined,
      { signature }
    )
  }

  getSeverity(): 'high' {
    return 'high'
  }

  shouldAlert(): boolean {
    return true
  }
}

/**
 * Webhook processing failed error
 */
export class WebhookProcessingError extends WebhookError {
  constructor(
    eventType: string,
    eventId: string,
    error: Error,
    organizationId?: string
  ) {
    super(
      `Failed to process webhook event ${eventType}: ${error.message}`,
      'WEBHOOK_PROCESSING_FAILED',
      eventId,
      undefined,
      organizationId,
      { 
        eventType, 
        originalError: error.message,
        originalStack: error.stack 
      }
    )
  }
}

/**
 * Stripe API errors
 */
export class StripeApiError extends StripeError {
  constructor(
    operation: string,
    stripeError: any,
    userId?: string,
    organizationId?: string
  ) {
    super(
      `Stripe API error during ${operation}: ${stripeError.message}`,
      'STRIPE_API_ERROR',
      userId,
      organizationId,
      {
        operation,
        stripeErrorType: stripeError.type,
        stripeErrorCode: stripeError.code,
        stripeErrorParam: stripeError.param,
        stripeRequestId: stripeError.requestId
      }
    )
  }

  getUserMessage(): string {
    const stripeErrorType = this.metadata?.stripeErrorType
    
    switch (stripeErrorType) {
      case 'card_error':
        return "Erro no cartão de crédito. Verifique os dados do cartão."
      case 'rate_limit_error':
        return "Muitas solicitações. Tente novamente em alguns instantes."
      case 'invalid_request_error':
        return "Solicitação inválida. Tente novamente."
      case 'authentication_error':
        return "Erro de autenticação. Contate o suporte."
      case 'api_connection_error':
        return "Erro de conexão. Tente novamente."
      case 'api_error':
        return "Erro interno do sistema de pagamentos. Tente novamente."
      default:
        return "Erro no sistema de pagamentos. Tente novamente."
    }
  }

  getSeverity(): 'high' {
    return 'high'
  }

  shouldAlert(): boolean {
    const stripeErrorType = this.metadata?.stripeErrorType
    // Don't alert for card errors (user errors), but alert for system errors
    return stripeErrorType !== 'card_error'
  }
}

/**
 * Configuration errors for Stripe
 */
export class StripeConfigurationError extends SystemError {
  constructor(
    configKey: string,
    issue: string,
    userId?: string
  ) {
    super(
      `Stripe configuration error for ${configKey}: ${issue}`,
      'STRIPE_CONFIGURATION_ERROR',
      undefined,
      userId,
      undefined,
      `stripe:${configKey}`
    )
  }

  getUserMessage(): string {
    return "Erro de configuração do sistema de pagamentos. Contate o suporte."
  }

  getSeverity(): 'high' {
    return 'high'
  }

  shouldAlert(): boolean {
    return true
  }
}

// Utility functions for creating common Stripe errors
export function createTrialAlreadyUsedError(organizationId: string, userId?: string): TrialAlreadyUsedError {
  return new TrialAlreadyUsedError(organizationId, userId)
}

export function createTrialExpiredError(organizationId: string, trialEndDate: Date, userId?: string): TrialExpiredError {
  return new TrialExpiredError(organizationId, trialEndDate, userId)
}

export function createTrialNotEligibleError(organizationId: string, reason: string, userId?: string): TrialNotEligibleError {
  return new TrialNotEligibleError(organizationId, reason, userId)
}

export function createInvalidTrialStateError(
  organizationId: string,
  currentState: string,
  expectedState: string,
  userId?: string
): InvalidTrialStateError {
  return new InvalidTrialStateError(organizationId, currentState, expectedState, userId)
}

export function createSubscriptionNotFoundError(organizationId: string, userId?: string): SubscriptionNotFoundError {
  return new SubscriptionNotFoundError(organizationId, userId)
}

export function createSubscriptionAlreadyExistsError(
  organizationId: string,
  subscriptionId: string,
  userId?: string
): SubscriptionAlreadyExistsError {
  return new SubscriptionAlreadyExistsError(organizationId, subscriptionId, userId)
}

export function createPaymentFailedError(
  organizationId: string,
  paymentIntentId: string,
  reason: string,
  userId?: string
): PaymentFailedError {
  return new PaymentFailedError(organizationId, paymentIntentId, reason, userId)
}

export function createWebhookSignatureError(signature: string, webhookEventId?: string): WebhookSignatureError {
  return new WebhookSignatureError(signature, webhookEventId)
}

export function createWebhookProcessingError(
  eventType: string,
  eventId: string,
  error: Error,
  organizationId?: string
): WebhookProcessingError {
  return new WebhookProcessingError(eventType, eventId, error, organizationId)
}

export function createStripeApiError(
  operation: string,
  stripeError: any,
  userId?: string,
  organizationId?: string
): StripeApiError {
  return new StripeApiError(operation, stripeError, userId, organizationId)
}

export function createStripeConfigurationError(
  configKey: string,
  issue: string,
  userId?: string
): StripeConfigurationError {
  return new StripeConfigurationError(configKey, issue, userId)
}

// Type guards for Stripe errors
export function isTrialError(error: any): error is TrialError {
  return error instanceof TrialError
}

export function isSubscriptionError(error: any): error is SubscriptionError {
  return error instanceof SubscriptionError
}

export function isPaymentError(error: any): error is PaymentError {
  return error instanceof PaymentError
}

export function isWebhookError(error: any): error is WebhookError {
  return error instanceof WebhookError
}

export function isStripeApiError(error: any): error is StripeApiError {
  return error instanceof StripeApiError
}

export function isStripeConfigurationError(error: any): error is StripeConfigurationError {
  return error instanceof StripeConfigurationError
}