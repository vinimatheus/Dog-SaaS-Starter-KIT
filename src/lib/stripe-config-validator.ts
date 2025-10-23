/**
 * Stripe Configuration Validator
 * 
 * Validates all required Stripe environment variables and configuration
 * on application startup and provides health check endpoints.
 */

import Stripe from "stripe"

export interface StripeConfigValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  config: {
    hasSecretKey: boolean
    hasWebhookSecret: boolean
    hasPriceId: boolean
    hasPublicUrl: boolean
    environment: 'test' | 'live' | 'unknown'
    apiVersion: string
  }
}

export interface StripeHealthCheckResult {
  isHealthy: boolean
  checks: {
    apiConnection: boolean
    webhookEndpoint: boolean
    productConfiguration: boolean
    priceConfiguration: boolean
  }
  errors: string[]
  timestamp: Date
}

/**
 * Required Stripe environment variables
 */
const REQUIRED_STRIPE_ENV_VARS = {
  STRIPE_SECRET_KEY: 'Chave secreta do Stripe (sk_test_... ou sk_live_...)',
  STRIPE_WEBHOOK_SECRET: 'Secret do webhook do Stripe (whsec_...)',
  STRIPE_PRO_PLAN_PRICE_ID: 'ID do preço do plano Pro (price_...)',
  NEXT_PUBLIC_APP_URL: 'URL pública da aplicação para redirects'
} as const

/**
 * Optional Stripe environment variables with defaults
 */
const OPTIONAL_STRIPE_ENV_VARS = {
  STRIPE_PUBLISHABLE_KEY: 'Chave pública do Stripe (pk_test_... ou pk_live_...)',
  STRIPE_WEBHOOK_TOLERANCE: 'Tolerância do webhook em segundos (padrão: 300)'
} as const

/**
 * Required webhook events for the application
 */
export const REQUIRED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed'
] as const

/**
 * Validates Stripe configuration on startup
 */
export function validateStripeConfig(): StripeConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check required environment variables
  for (const [envVar, description] of Object.entries(REQUIRED_STRIPE_ENV_VARS)) {
    const value = process.env[envVar]
    
    if (!value) {
      errors.push(`❌ ${envVar} não está definida. ${description}`)
      continue
    }
    
    // Validate format of specific variables
    switch (envVar) {
      case 'STRIPE_SECRET_KEY':
        if (!value.startsWith('sk_')) {
          errors.push(`❌ ${envVar} deve começar com 'sk_' (formato: sk_test_... ou sk_live_...)`)
        }
        break
        
      case 'STRIPE_WEBHOOK_SECRET':
        if (!value.startsWith('whsec_')) {
          errors.push(`❌ ${envVar} deve começar com 'whsec_'`)
        }
        break
        
      case 'STRIPE_PRO_PLAN_PRICE_ID':
        if (!value.startsWith('price_')) {
          errors.push(`❌ ${envVar} deve começar com 'price_'`)
        }
        break
        
      case 'NEXT_PUBLIC_APP_URL':
        try {
          new URL(value)
        } catch {
          errors.push(`❌ ${envVar} deve ser uma URL válida`)
        }
        break
    }
  }
  
  // Check optional variables and provide warnings
  for (const [envVar, description] of Object.entries(OPTIONAL_STRIPE_ENV_VARS)) {
    const value = process.env[envVar]
    
    if (!value) {
      warnings.push(`⚠️  ${envVar} não está definida. ${description}`)
    }
  }
  
  // Determine environment
  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  let environment: 'test' | 'live' | 'unknown' = 'unknown'
  
  if (secretKey.startsWith('sk_test_')) {
    environment = 'test'
  } else if (secretKey.startsWith('sk_live_')) {
    environment = 'live'
  }
  
  // Environment-specific warnings
  if (environment === 'live' && process.env.NODE_ENV !== 'production') {
    warnings.push('⚠️  Usando chaves de produção do Stripe em ambiente não-produção')
  }
  
  if (environment === 'test' && process.env.NODE_ENV === 'production') {
    warnings.push('⚠️  Usando chaves de teste do Stripe em ambiente de produção')
  }
  
  const config = {
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasPriceId: !!process.env.STRIPE_PRO_PLAN_PRICE_ID,
    hasPublicUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    environment,
    apiVersion: '2025-08-27.basil'
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config
  }
}

/**
 * Performs health check of Stripe integration
 */
export async function performStripeHealthCheck(): Promise<StripeHealthCheckResult> {
  const errors: string[] = []
  const checks = {
    apiConnection: false,
    webhookEndpoint: false,
    productConfiguration: false,
    priceConfiguration: false
  }
  
  try {
    // Initialize Stripe client
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY não está definida')
    }
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
    
    // Test API connection
    try {
      await stripe.balance.retrieve()
      checks.apiConnection = true
    } catch (error: any) {
      errors.push(`Falha na conexão com API do Stripe: ${error.message}`)
    }
    
    // Test price configuration
    if (process.env.STRIPE_PRO_PLAN_PRICE_ID) {
      try {
        const price = await stripe.prices.retrieve(process.env.STRIPE_PRO_PLAN_PRICE_ID)
        checks.priceConfiguration = true
        
        // Check if price has a product
        if (price.product) {
          try {
            await stripe.products.retrieve(price.product as string)
            checks.productConfiguration = true
          } catch (error: any) {
            errors.push(`Produto associado ao preço não encontrado: ${error.message}`)
          }
        }
      } catch (error: any) {
        errors.push(`Preço do plano Pro não encontrado: ${error.message}`)
      }
    }
    
    // Test webhook endpoint (basic validation)
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      // We can't easily test webhook endpoint without making a request
      // but we can validate the secret format
      if (process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
        checks.webhookEndpoint = true
      } else {
        errors.push('Formato do webhook secret inválido')
      }
    }
    
  } catch (error: any) {
    errors.push(`Erro geral na verificação do Stripe: ${error.message}`)
  }
  
  return {
    isHealthy: errors.length === 0 && Object.values(checks).every(check => check),
    checks,
    errors,
    timestamp: new Date()
  }
}

/**
 * Validates Stripe configuration and throws error if invalid
 * Use this on application startup
 */
export function validateStripeConfigOrThrow(): void {
  const validation = validateStripeConfig()
  
  if (!validation.isValid) {
    const errorMessage = [
      '🚨 Configuração do Stripe inválida:',
      '',
      ...validation.errors,
      '',
      'Verifique seu arquivo .env e configure as variáveis necessárias.',
      'Consulte a documentação para mais detalhes.'
    ].join('\n')
    
    throw new Error(errorMessage)
  }
  
  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Avisos de configuração do Stripe:')
    validation.warnings.forEach(warning => console.warn(warning))
  }
  
  // Log successful validation
  console.log(`✅ Configuração do Stripe validada (ambiente: ${validation.config.environment})`)
}

/**
 * Gets current Stripe configuration status
 */
export function getStripeConfigStatus() {
  const validation = validateStripeConfig()
  
  return {
    ...validation,
    envVars: {
      required: Object.keys(REQUIRED_STRIPE_ENV_VARS).map(key => ({
        name: key,
        present: !!process.env[key],
        description: REQUIRED_STRIPE_ENV_VARS[key as keyof typeof REQUIRED_STRIPE_ENV_VARS]
      })),
      optional: Object.keys(OPTIONAL_STRIPE_ENV_VARS).map(key => ({
        name: key,
        present: !!process.env[key],
        description: OPTIONAL_STRIPE_ENV_VARS[key as keyof typeof OPTIONAL_STRIPE_ENV_VARS]
      }))
    }
  }
}