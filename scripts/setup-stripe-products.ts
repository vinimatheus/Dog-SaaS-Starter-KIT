#!/usr/bin/env tsx

/**
 * Stripe Products Setup Script
 * 
 * This script creates the required Stripe products and prices for the application.
 * Run this script after setting up your Stripe account and before deploying.
 * 
 * Usage:
 *   npm run setup:stripe-products
 *   or
 *   npx tsx scripts/setup-stripe-products.ts
 */

import Stripe from 'stripe'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
config()

interface ProductConfig {
  name: string
  description: string
  prices: {
    nickname: string
    currency: string
    recurring: {
      interval: 'month' | 'year'
      interval_count?: number
    }
    unit_amount: number
    trial_period_days?: number
  }[]
  features: string[]
}

const PRODUCTS_CONFIG: Record<string, ProductConfig> = {
  pro: {
    name: 'Dog SaaS Pro',
    description: 'Plano Pro com funcionalidades avançadas e período de teste gratuito de 7 dias',
    features: [
      'Funcionalidades avançadas',
      'Suporte prioritário',
      'Relatórios detalhados',
      'Integrações premium',
      '7 dias de teste gratuito'
    ],
    prices: [
      {
        nickname: 'Pro Monthly',
        currency: 'brl',
        recurring: {
          interval: 'month'
        },
        unit_amount: 2900, // R$ 29.00
        trial_period_days: 7
      },
      {
        nickname: 'Pro Yearly',
        currency: 'brl',
        recurring: {
          interval: 'year'
        },
        unit_amount: 29000, // R$ 290.00 (2 meses grátis)
        trial_period_days: 7
      }
    ]
  }
}

async function setupStripeProducts() {
  console.log('🚀 Iniciando configuração dos produtos Stripe...\n')
  
  // Validate environment
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY não está definida no arquivo .env')
    process.exit(1)
  }
  
  if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    console.error('❌ STRIPE_SECRET_KEY deve começar com "sk_"')
    process.exit(1)
  }
  
  const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')
  const environment = isTestMode ? 'TEST' : 'LIVE'
  
  console.log(`🔧 Ambiente: ${environment}`)
  console.log(`🔑 Chave: ${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...`)
  
  if (!isTestMode) {
    console.log('\n⚠️  ATENÇÃO: Você está usando chaves de PRODUÇÃO!')
    console.log('⚠️  Certifique-se de que isso é intencional.')
    
    // In a real script, you might want to add a confirmation prompt here
  }
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  })
  
  console.log('\n📦 Criando produtos e preços...\n')
  
  const results: Record<string, { productId: string; priceIds: string[] }> = {}
  
  for (const [key, config] of Object.entries(PRODUCTS_CONFIG)) {
    console.log(`📋 Configurando produto: ${config.name}`)
    
    try {
      // Create product
      const product = await stripe.products.create({
        name: config.name,
        description: config.description,
        metadata: {
          features: config.features.join(','),
          environment: environment.toLowerCase(),
          created_by: 'setup-script'
        }
      })
      
      console.log(`  ✅ Produto criado: ${product.id}`)
      
      const priceIds: string[] = []
      
      // Create prices for this product
      for (const priceConfig of config.prices) {
        const price = await stripe.prices.create({
          product: product.id,
          nickname: priceConfig.nickname,
          currency: priceConfig.currency,
          recurring: priceConfig.recurring,
          unit_amount: priceConfig.unit_amount,
          metadata: {
            trial_period_days: priceConfig.trial_period_days?.toString() || '0',
            environment: environment.toLowerCase()
          }
        })
        
        console.log(`  ✅ Preço criado: ${price.id} (${priceConfig.nickname})`)
        priceIds.push(price.id)
      }
      
      results[key] = {
        productId: product.id,
        priceIds
      }
      
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar produto ${config.name}:`, error.message)
      process.exit(1)
    }
  }
  
  console.log('\n🎉 Produtos criados com sucesso!\n')
  
  // Generate environment variables
  console.log('📝 Adicione estas variáveis ao seu arquivo .env:\n')
  console.log('# Stripe Products (gerado automaticamente)')
  
  if (results.pro) {
    // Use the first price (monthly) as the default
    console.log(`STRIPE_PRO_PLAN_PRICE_ID="${results.pro.priceIds[0]}"`)
    
    if (results.pro.priceIds[1]) {
      console.log(`STRIPE_PRO_PLAN_YEARLY_PRICE_ID="${results.pro.priceIds[1]}"`)
    }
    
    console.log(`STRIPE_PRO_PRODUCT_ID="${results.pro.productId}"`)
  }
  
  console.log('\n📋 Resumo dos produtos criados:')
  for (const [key, result] of Object.entries(results)) {
    const config = PRODUCTS_CONFIG[key]
    console.log(`\n${config.name}:`)
    console.log(`  Produto ID: ${result.productId}`)
    result.priceIds.forEach((priceId, index) => {
      const priceConfig = config.prices[index]
      console.log(`  Preço ID (${priceConfig.nickname}): ${priceId}`)
    })
  }
  
  console.log('\n✨ Configuração concluída!')
  console.log('\n📚 Próximos passos:')
  console.log('1. Copie as variáveis de ambiente geradas para seu arquivo .env')
  console.log('2. Configure os webhooks com: npm run setup:stripe-webhooks')
  console.log('3. Teste a integração com: npm run test:stripe')
}

// Run the script
if (require.main === module) {
  setupStripeProducts().catch((error) => {
    console.error('💥 Erro fatal:', error)
    process.exit(1)
  })
}

export { setupStripeProducts }