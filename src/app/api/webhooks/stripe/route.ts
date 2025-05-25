import { headers } from "next/headers"
import { handleStripeWebhookAction } from "@/actions/stripe.actions"
import { NextResponse } from "next/server"
import Stripe from "stripe"

let stripeAPIIPsCache: string[] | null = null
let stripeWebhookIPsCache: string[] | null = null
let lastIPsUpdate: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 

async function getStripeAPIIPs(): Promise<string[]> {
  const now = Date.now()
  
  if (stripeAPIIPsCache && (now - lastIPsUpdate) < CACHE_DURATION) {
    return stripeAPIIPsCache
  }

  try {
    const response = await fetch('https://stripe.com/files/ips/ips_api.json')
    if (!response.ok) {
      throw new Error(`Erro ao buscar IPs da API: ${response.statusText}`)
    }
    
    const data = await response.json()
    stripeAPIIPsCache = data.API
    lastIPsUpdate = now
    return data.API
  } catch (error) {
    console.error('Erro ao buscar IPs da API do Stripe:', error)
    if (stripeAPIIPsCache) {
      return stripeAPIIPsCache
    }
    throw error
  }
}

async function getStripeWebhookIPs(): Promise<string[]> {
  const now = Date.now()
  
  if (stripeWebhookIPsCache && (now - lastIPsUpdate) < CACHE_DURATION) {
    return stripeWebhookIPsCache
  }

  try {
    const response = await fetch('https://stripe.com/files/ips/ips_webhooks.json')
    if (!response.ok) {
      throw new Error(`Erro ao buscar IPs de webhook: ${response.statusText}`)
    }
    
    const data = await response.json()
    stripeWebhookIPsCache = data.WEBHOOKS
    lastIPsUpdate = now
    return data.WEBHOOKS
  } catch (error) {
    console.error('Erro ao buscar IPs de webhook do Stripe:', error)
    if (stripeWebhookIPsCache) {
      return stripeWebhookIPsCache
    }
    throw error
  }
}

async function isValidStripeIP(ip: string): Promise<boolean> {
  try {
    const webhookIPs = await getStripeWebhookIPs()
    
    if (webhookIPs.includes(ip)) {
      return true
    }

    const apiIPs = await getStripeAPIIPs()
    return apiIPs.includes(ip)
  } catch (error) {
    console.error('Erro ao verificar IP:', error)
    return false
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers()
    const signature = headersList.get("stripe-signature")
    const forwardedFor = headersList.get("x-forwarded-for")
    const realIP = headersList.get("x-real-ip")
    
    const clientIP = forwardedFor?.split(",")[0] || realIP || "unknown"
    
    const isValidIP = await isValidStripeIP(clientIP)
    if (!isValidIP) {
      console.error(`IP de origem inválido: ${clientIP}`)
      return NextResponse.json(
        { error: "IP de origem não autorizado" },
        { status: 403 }
      )
    }

    if (!signature) {
      console.error("Stripe signature não encontrada")
      return NextResponse.json(
        { error: "Stripe signature não encontrada" },
        { status: 400 }
      )
    }

    const rawBody = await req.arrayBuffer()
    const payload = Buffer.from(rawBody)
    
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET não está definido")
      return NextResponse.json(
        { error: "Configuração do webhook incompleta" },
        { status: 500 }
      )
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET.trim()
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET está vazio após remoção de espaços")
      return NextResponse.json(
        { error: "Configuração do webhook inválida" },
        { status: 500 }
      )
    }

    console.log("Webhook Secret:", webhookSecret)
    console.log("Signature:", signature)
    console.log("Payload (primeiros 100 bytes):", payload.toString('utf8').substring(0, 100))

    const result = await handleStripeWebhookAction(signature, payload, webhookSecret)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Erro detalhado no webhook:", error)
    
    const stripeError = error as Stripe.errors.StripeError
    return NextResponse.json(
      { 
        error: "Erro ao processar webhook",
        details: stripeError.message,
        type: stripeError.type
      },
      { status: 400 }
    )
  }
} 