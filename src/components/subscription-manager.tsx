"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlanType } from "@prisma/client"
import { Check, Crown, Loader2, CreditCard } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { createCheckoutSession, createCustomerPortalSession } from "@/actions/stripe.actions"

interface SubscriptionManagerProps {
  organizationId: string
  plan: PlanType
  isOwner: boolean
  subscription?: {
    status: string
    currentPeriodEnd: Date
    cancelAtPeriodEnd: boolean
    lastPaymentDate: Date
    nextBillingDate: Date
  }
}

export function SubscriptionManager({
  organizationId,
  plan,
  isOwner,
  subscription,
}: SubscriptionManagerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isPortalLoading, setIsPortalLoading] = useState(false)

  const handleUpgrade = async () => {
    try {
      setIsLoading(true)
      const { url } = await createCheckoutSession(organizationId)
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error("Erro ao iniciar checkout")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    try {
      setIsPortalLoading(true)
      const { url } = await createCustomerPortalSession(organizationId)
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error("Erro ao acessar o portal de gerenciamento")
      }
    } finally {
      setIsPortalLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date)
  }

  if (!isOwner) {
    return null
  }

  return (
    <div className="grid gap-6">
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Assinatura</CardTitle>
            <CardDescription>
              Informações sobre sua assinatura atual
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {subscription.status === "active" ? "Ativa" : subscription.status}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Próxima cobrança</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(subscription.nextBillingDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Último pagamento</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(subscription.lastPaymentDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Cancelamento</p>
                <p className="text-sm text-muted-foreground">
                  {subscription.cancelAtPeriodEnd
                    ? "Será cancelada ao final do período"
                    : "Não cancelada"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageSubscription}
              disabled={isPortalLoading}
            >
              {isPortalLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Gerenciar Assinatura
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {plan !== "PRO" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Plano Gratuito</span>
                {plan === "FREE" && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Atual
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Perfeito para começar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">Até 1 membros</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">Funcionalidades básicas</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                disabled={plan === "FREE" || !isOwner}
              >
                {plan === "FREE" ? "Plano Atual" : "Selecionar"}
              </Button>
            </CardFooter>
          </Card>
        )}

        <Card className={plan === "PRO" ? "md:col-span-2" : "border-primary/50"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <span>Plano Pro</span>
              {plan === "PRO" && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  Atual
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Recursos avançados para equipes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">Membros ilimitados</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">Todas as funcionalidades</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">Suporte prioritário</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleUpgrade}
              disabled={plan === "PRO" || !isOwner || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : plan === "PRO" ? (
                "Plano Atual"
              ) : (
                "Fazer Upgrade"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 