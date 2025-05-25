"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import Stripe from "stripe"
import { PlanType } from "@prisma/client"
import { stripe } from "@/lib/stripe"

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
})

export async function createCheckoutSession(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      User_Organization: {
        where: {
          user_id: session.user.id,
        },
      },
    },
  })

  if (!organization) {
    throw new Error("Organização não encontrada")
  }

  const currentUserOrg = organization.User_Organization[0]

  if (!currentUserOrg) {
    throw new Error("Usuário não é membro da organização")
  }

  if (currentUserOrg.role !== "OWNER") {
    throw new Error("Apenas o dono pode gerenciar a assinatura")
  }

  if (organization.plan === "PRO") {
    throw new Error("Organização já possui plano Pro")
  }

  if (organization.stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: organization.stripeCustomerId,
      status: "active",
      price: process.env.STRIPE_PRO_PLAN_PRICE_ID,
    })

    if (subscriptions.data.length > 0) {
      throw new Error("Já existe uma assinatura ativa para este plano")
    }
  }

  const checkoutSession = await stripe.checkout.sessions.create({
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
    },
  })

  return { url: checkoutSession.url }
}

export async function createCustomerPortalSession(organizationId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      User_Organization: {
        where: {
          user_id: session.user.id,
        },
      },
    },
  })

  if (!organization) {
    throw new Error("Organização não encontrada")
  }

  const currentUserOrg = organization.User_Organization[0]

  if (!currentUserOrg) {
    throw new Error("Usuário não é membro da organização")
  }

  if (currentUserOrg.role !== "OWNER") {
    throw new Error("Apenas o dono pode gerenciar a assinatura")
  }

  if (!organization.stripeSubscriptionId) {
    throw new Error("Organização não possui assinatura ativa")
  }

  if (!organization.stripeCustomerId) {
    throw new Error("Organização não possui um ID de cliente do Stripe")
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: organization.stripeCustomerId!,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/${organization.uniqueId}/config/subscription`,
  })

  return { url: portalSession.url }
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

        const updatedOrg = await prisma.organization.update({
          where: { id: organizationId },
          data: {
            plan: PlanType.PRO,
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
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
    where: { id: organizationId },
    include: {
      User_Organization: {
        where: {
          user_id: session.user.id,
        },
      },
    },
  })

  if (!organization) {
    throw new Error("Organização não encontrada")
  }

  const currentUserOrg = organization.User_Organization[0]

  if (!currentUserOrg) {
    throw new Error("Usuário não é membro da organização")
  }

  if (currentUserOrg.role !== "OWNER") {
    throw new Error("Apenas o dono pode gerenciar a assinatura")
  }

  if (!organization.stripeSubscriptionId) {
    throw new Error("Organização não possui assinatura ativa")
  }

  await stripe.subscriptions.update(organization.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  return { success: true }
} 