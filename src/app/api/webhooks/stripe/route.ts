import { headers } from "next/headers"
import { handleStripeWebhookAction } from "@/actions/stripe.actions"
import { NextResponse } from "next/server"

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

    const body = await req.text()
    console.log("Webhook recebido:", body)

    const result = await handleStripeWebhookAction(signature, Buffer.from(body))
    console.log("Resultado do webhook:", result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Erro no webhook:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
} 