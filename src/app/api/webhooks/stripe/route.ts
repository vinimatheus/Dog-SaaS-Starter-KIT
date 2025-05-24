import { headers } from "next/headers"
import { handleStripeWebhookAction } from "@/actions/stripe.actions"
import { NextResponse } from "next/server"
import Stripe from "stripe"

export async function POST(req: Request) {
  try {
    const headersList = await headers()
    const signature = headersList.get("stripe-signature")

    if (!signature) {
      console.error("Stripe signature não encontrada")
      return NextResponse.json(
        { error: "Stripe signature não encontrada" },
        { status: 400 }
      )
    }

    // Lê o corpo da requisição como ArrayBuffer para preservar exatamente como recebido
    const rawBody = await req.arrayBuffer()
    const payload = Buffer.from(rawBody)
    
    // Verifica se o STRIPE_WEBHOOK_SECRET está definido
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET não está definido")
      return NextResponse.json(
        { error: "Configuração do webhook incompleta" },
        { status: 500 }
      )
    }

    // Remove espaços em branco extras do secret e verifica se está vazio
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET.trim()
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET está vazio após remoção de espaços")
      return NextResponse.json(
        { error: "Configuração do webhook inválida" },
        { status: 500 }
      )
    }

    // Log para debug (remover em produção)
    console.log("Webhook Secret:", webhookSecret)
    console.log("Signature:", signature)
    console.log("Payload (primeiros 100 bytes):", payload.toString('utf8').substring(0, 100))

    const result = await handleStripeWebhookAction(signature, payload, webhookSecret)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Erro detalhado no webhook:", error)
    
    // Retorna uma resposta mais informativa em caso de erro
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