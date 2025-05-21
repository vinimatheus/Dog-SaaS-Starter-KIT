import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PageLayout } from "@/components/page-layout"
import { SubscriptionManager } from "@/components/subscription-manager"
import { Metadata } from "next"
import { stripe } from "@/lib/stripe"

interface MetadataProps {
  params: Promise<{
    org_unique_id: string
  }>
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  await params

  return {
    title: "Assinatura",
    description: "Gerencie a assinatura da sua organização",
  }
}

interface PageProps {
  params: Promise<{
    org_unique_id: string
  }>
}

export default async function SubscriptionPage({
  params,
}: PageProps) {
  const { org_unique_id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const organization = await prisma.organization.findUnique({
    where: { uniqueId: org_unique_id },
    include: {
      User_Organization: {
        where: {
          user_id: session.user.id,
        },
      },
    },
  })

  if (!organization) {
    redirect("/organizations")
  }

  const currentUserOrg = organization.User_Organization[0]

  if (!currentUserOrg) {
    redirect("/organizations")
  }

  const isOwner = currentUserOrg.role === "OWNER"

  // Buscar informações da assinatura no Stripe
  let subscription = undefined
  if (organization.stripeSubscriptionId) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        organization.stripeSubscriptionId
      )

      const item = stripeSubscription.items.data[0]

      subscription = {
        status: stripeSubscription.status,
        currentPeriodEnd: new Date(item.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        lastPaymentDate: new Date(item.current_period_start * 1000),
        nextBillingDate: new Date(item.current_period_end * 1000),
      }
    } catch (error) {
      console.error("Erro ao buscar assinatura:", error)
    }
  }

  return (
    <PageLayout
      title="Assinatura"
      description="Gerencie a assinatura da sua organização"
    >
      <div className="grid gap-6">
        <SubscriptionManager
          organizationId={organization.id}
          plan={organization.plan}
          isOwner={isOwner}
          subscription={subscription}
        />

        {!isOwner && (
          <div className="bg-card rounded-md border border-muted p-4">
            <p className="text-sm text-muted-foreground">
              Apenas o dono da organização pode gerenciar a assinatura.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  )
} 