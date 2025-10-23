"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PlanType } from "@prisma/client"
import { Check, Crown, Loader2, CreditCard, Clock, AlertTriangle, Calendar, DollarSign } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createCheckoutSession, createCustomerPortalSession, getTrialStatusAction, getSubscriptionDetailsAction } from "@/actions/stripe.actions"
import { TrialStatus, SubscriptionDetails } from "@/types/stripe"
import { formatTrialDaysRemaining, isTrialAboutToExpire } from "@/lib/trial-utils"

interface SubscriptionManagerProps {
  organizationId: string
  plan: PlanType
  isOwner: boolean
}

export function SubscriptionManager({
  organizationId,
  plan,
  isOwner,
}: SubscriptionManagerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null)
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)

  // Load trial status and subscription details
  useEffect(() => {
    const loadSubscriptionData = async () => {
      if (!isOwner) {
        setIsLoadingData(false)
        return
      }

      try {
        const [trialData, subscriptionData] = await Promise.all([
          getTrialStatusAction(organizationId),
          getSubscriptionDetailsAction(organizationId)
        ])
        
        setTrialStatus(trialData)
        setSubscriptionDetails(subscriptionData)
      } catch (error) {
        console.error("Error loading subscription data:", error)
        // Don't show error toast for permission errors, just log them
      } finally {
        setIsLoadingData(false)
      }
    }

    loadSubscriptionData()
  }, [organizationId, isOwner])

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

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A"
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date)
  }

  const formatCurrency = (amount: number, currency: string = "BRL") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100) // Convert from cents
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Ativa</Badge>
      case "trialing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Em Teste</Badge>
      case "past_due":
        return <Badge variant="destructive">Pagamento Pendente</Badge>
      case "canceled":
        return <Badge variant="outline">Cancelada</Badge>
      case "unpaid":
        return <Badge variant="destructive">Não Paga</Badge>
      default:
        return <Badge variant="outline">Desconhecido</Badge>
    }
  }

  if (!isOwner) {
    return null
  }

  if (isLoadingData) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando informações da assinatura...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {/* Trial Status Alert */}
      {trialStatus?.isInTrial && (
        <Alert className={isTrialAboutToExpire(trialStatus.trialEndDate) ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50"}>
          <Clock className={`h-4 w-4 ${isTrialAboutToExpire(trialStatus.trialEndDate) ? "text-orange-600" : "text-blue-600"}`} />
          <AlertDescription className={isTrialAboutToExpire(trialStatus.trialEndDate) ? "text-orange-800" : "text-blue-800"}>
            <strong>Período de teste ativo!</strong> {formatTrialDaysRemaining(trialStatus.daysRemaining)}
            {isTrialAboutToExpire(trialStatus.trialEndDate) && (
              <span className="block mt-1 text-sm">
                Seu teste expira em breve. Considere fazer o upgrade para continuar usando as funcionalidades Pro.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Trial Expired Alert */}
      {trialStatus?.hasUsedTrial && !trialStatus.isInTrial && plan !== "PRO" && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Período de teste expirado.</strong> Faça o upgrade para o plano Pro para continuar usando as funcionalidades avançadas.
          </AlertDescription>
        </Alert>
      )}

      {/* Subscription Details */}
      {subscriptionDetails && subscriptionDetails.status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Detalhes da Assinatura</span>
              {getStatusBadge(subscriptionDetails.status)}
            </CardTitle>
            <CardDescription>
              Informações completas sobre sua assinatura atual
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {/* Trial Information */}
            {trialStatus?.isInTrial && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Período de Teste
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700 font-medium">Início do teste</p>
                    <p className="text-blue-600">{formatDate(trialStatus.trialStartDate)}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Fim do teste</p>
                    <p className="text-blue-600">{formatDate(trialStatus.trialEndDate)}</p>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-blue-100 rounded text-center">
                  <p className="text-blue-800 font-medium">
                    {formatTrialDaysRemaining(trialStatus.daysRemaining)}
                  </p>
                </div>
              </div>
            )}

            {/* Subscription Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Período atual
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(subscriptionDetails.currentPeriodStart)} - {formatDate(subscriptionDetails.currentPeriodEnd)}
                </p>
              </div>
              
              {subscriptionDetails.nextBillingDate && (
                <div>
                  <p className="text-sm font-medium flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Próxima cobrança
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(subscriptionDetails.nextBillingDate)}
                  </p>
                </div>
              )}

              {subscriptionDetails.lastPaymentDate && (
                <div>
                  <p className="text-sm font-medium">Último pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(subscriptionDetails.lastPaymentDate)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium">Status do cancelamento</p>
                <p className="text-sm text-muted-foreground">
                  {subscriptionDetails.cancelAtPeriodEnd
                    ? "Será cancelada ao final do período"
                    : "Não cancelada"}
                </p>
              </div>
            </div>

            {/* Payment Method Information */}
            {subscriptionDetails.paymentMethod && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Método de Pagamento
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {subscriptionDetails.paymentMethod.brand} •••• {subscriptionDetails.paymentMethod.last4}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expira em {subscriptionDetails.paymentMethod.expiryMonth.toString().padStart(2, '0')}/{subscriptionDetails.paymentMethod.expiryYear}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Invoice */}
            {subscriptionDetails.upcomingInvoice && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">Próxima Fatura</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700">
                      {formatDate(subscriptionDetails.upcomingInvoice.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-800">
                      {formatCurrency(subscriptionDetails.upcomingInvoice.amount, subscriptionDetails.upcomingInvoice.currency)}
                    </p>
                  </div>
                </div>
              </div>
            )}

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
              {trialStatus?.isInTrial && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Em Teste
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Recursos avançados para equipes
              {trialStatus?.isInTrial && (
                <span className="block mt-1 text-blue-600 font-medium">
                  Teste gratuito por 7 dias - sem compromisso!
                </span>
              )}
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
              {plan !== "PRO" && !trialStatus?.hasUsedTrial && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">7 dias grátis para testar</span>
                </div>
              )}
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
              ) : trialStatus?.hasUsedTrial ? (
                "Fazer Upgrade"
              ) : (
                "Iniciar Teste Gratuito"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 