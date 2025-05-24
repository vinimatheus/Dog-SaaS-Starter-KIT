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

    // Lê o corpo da requisição como texto bruto
    const rawBody = await req.text()
    
    // Verifica se o STRIPE_WEBHOOK_SECRET está definido
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET não está definido")
      return NextResponse.json(
        { error: "Configuração do webhook incompleta" },
        { status: 500 }
      )
    }

    // Remove espaços em branco extras do secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET.trim()

    const result = await handleStripeWebhookAction(signature, Buffer.from(rawBody), webhookSecret)
    
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