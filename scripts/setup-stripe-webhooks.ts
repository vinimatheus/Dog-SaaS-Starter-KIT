#!/usr/bin/env tsx

/**
 * Stripe Webhooks Setup Script
 * 
 * This script creates and configures Stripe webhook endpoints for the application.
 * Run this script after setting up your Stripe products and before deploying.
 * 
 * Usage:
 *   npm run setup:stripe-webhooks
 *   or
 *   npx tsx scripts/setup-stripe-webhooks.ts
 */

import Stripe from 'stripe'
import { config } from 'dotenv'

// Load environment variables
config()

const REQUIRED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed'
] as const

interface WebhookConfig {
  url: string
  description: string
  events: typeof REQUIRED_WEBHOOK_EVENTS[number][]
  metadata?: Record<string, string>
}

async function setupStripeWebhooks() {
  console.log('🔗 Iniciando configuração dos webhooks Stripe...\n')
  
  // Validate environment
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY não está definida no arquivo .env')
    process.exit(1)
  }
  
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error('❌ NEXT_PUBLIC_APP_URL não está definida no arquivo .env')
    console.error('   Esta variável é necessária para configurar a URL do webhook')
    process.exit(1)
  }
  
  const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')
  const environment = isTestMode ? 'TEST' : 'LIVE'
  
  console.log(`🔧 Ambiente: ${environment}`)
  console.log(`🌐 URL da aplicação: ${process.env.NEXT_PUBLIC_APP_URL}`)
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  })
  
  // Construct webhook URL
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`
  
  console.log(`🎯 URL do webhook: ${webhookUrl}\n`)
  
  const webhookConfig: WebhookConfig = {
    url: webhookUrl,
    description: `Dog SaaS Webhook (${environment})`,
    events: [...REQUIRED_WEBHOOK_EVENTS],
    metadata: {
      environment: environment.toLowerCase(),
      created_by: 'setup-script',
      app_name: 'dog-saas'
    }
  }
  
  try {
    // Check if webhook already exists
    console.log('🔍 Verificando webhooks existentes...')
    const existingWebhooks = await stripe.webhookEndpoints.list({
      limit: 100
    })
    
    const existingWebhook = existingWebhooks.data.find(
      webhook => webhook.url === webhookUrl
    )
    
    if (existingWebhook) {
      console.log(`⚠️  Webhook já existe: ${existingWebhook.id}`)
      console.log('   Atualizando configuração...')
      
      // Update existing webhook
      const updatedWebhook = await stripe.webhookEndpoints.update(
        existingWebhook.id,
        {
          enabled_events: webhookConfig.events,
          description: webhookConfig.description,
          metadata: webhookConfig.metadata
        }
      )
      
      console.log(`✅ Webhook atualizado: ${updatedWebhook.id}`)
      console.log(`🔑 Webhook Secret: ${updatedWebhook.secret}`)
      
      // Display environment variable
      console.log('\n📝 Adicione esta variável ao seu arquivo .env:')
      console.log(`STRIPE_WEBHOOK_SECRET="${updatedWebhook.secret}"`)
      
    } else {
      console.log('📝 Criando novo webhook...')
      
      // Create new webhook
      const webhook = await stripe.webhookEndpoints.create({
        url: webhookConfig.url,
        enabled_events: webhookConfig.events,
        description: webhookConfig.description,
        metadata: webhookConfig.metadata
      })
      
      console.log(`✅ Webhook criado: ${webhook.id}`)
      console.log(`🔑 Webhook Secret: ${webhook.secret}`)
      
      // Display environment variable
      console.log('\n📝 Adicione esta variável ao seu arquivo .env:')
      console.log(`STRIPE_WEBHOOK_SECRET="${webhook.secret}"`)
    }
    
    console.log('\n📋 Eventos configurados:')
    webhookConfig.events.forEach(event => {
      console.log(`  ✓ ${event}`)
    })
    
    console.log('\n🎉 Webhook configurado com sucesso!')
    
    console.log('\n📚 Próximos passos:')
    console.log('1. Copie a variável STRIPE_WEBHOOK_SECRET para seu arquivo .env')
    console.log('2. Reinicie sua aplicação para aplicar as mudanças')
    console.log('3. Teste os webhooks com: stripe listen --forward-to localhost:3000/api/webhooks/stripe')
    
    if (isTestMode) {
      console.log('\n🧪 Para desenvolvimento local:')
      console.log('   Use o Stripe CLI para testar webhooks:')
      console.log('   stripe listen --forward-to localhost:3000/api/webhooks/stripe')
      console.log('   Isso gerará um webhook secret temporário para desenvolvimento')
    }
    
  } catch (error: any) {
    console.error('❌ Erro ao configurar webhook:', error.message)
    
    if (error.type === 'StripeInvalidRequestError') {
      console.error('\n💡 Possíveis soluções:')
      console.error('   - Verifique se a URL está acessível publicamente')
      console.error('   - Certifique-se de que NEXT_PUBLIC_APP_URL está correto')
      console.error('   - Para desenvolvimento, use ngrok ou similar para expor localhost')
    }
    
    process.exit(1)
  }
}

async function listWebhooks() {
  console.log('📋 Listando webhooks existentes...\n')
  
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY não está definida')
    process.exit(1)
  }
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  })
  
  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 })
    
    if (webhooks.data.length === 0) {
      console.log('📭 Nenhum webhook encontrado')
      return
    }
    
    webhooks.data.forEach((webhook, index) => {
      console.log(`${index + 1}. ${webhook.url}`)
      console.log(`   ID: ${webhook.id}`)
      console.log(`   Status: ${webhook.status}`)
      console.log(`   Eventos: ${webhook.enabled_events.length}`)
      console.log(`   Criado: ${new Date(webhook.created * 1000).toLocaleString()}`)
      console.log('')
    })
    
  } catch (error: any) {
    console.error('❌ Erro ao listar webhooks:', error.message)
    process.exit(1)
  }
}

// Command line interface
const command = process.argv[2]

if (require.main === module) {
  switch (command) {
    case 'list':
      listWebhooks().catch((error) => {
        console.error('💥 Erro fatal:', error)
        process.exit(1)
      })
      break
    
    default:
      setupStripeWebhooks().catch((error) => {
        console.error('💥 Erro fatal:', error)
        process.exit(1)
      })
      break
  }
}

export { setupStripeWebhooks, listWebhooks }