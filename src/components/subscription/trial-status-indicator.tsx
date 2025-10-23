"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Clock, Crown, AlertTriangle } from "lucide-react"
import { TrialStatus } from "@/types/stripe"
import { getTrialStatusAction } from "@/actions/stripe.actions"
import { formatTrialDaysRemaining, isTrialAboutToExpire } from "@/lib/trial-utils"

interface TrialStatusIndicatorProps {
  organizationId: string
  onUpgradeClick?: () => void
  variant?: "badge" | "button" | "minimal"
  showPopover?: boolean
}

export function TrialStatusIndicator({
  organizationId,
  onUpgradeClick,
  variant = "badge",
  showPopover = true
}: TrialStatusIndicatorProps) {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadTrialStatus = async () => {
      try {
        const status = await getTrialStatusAction(organizationId)
        setTrialStatus(status)
      } catch (error) {
        console.error("Error loading trial status:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTrialStatus()
  }, [organizationId])

  if (isLoading || !trialStatus) {
    return null
  }

  // Don't show anything if not in trial and hasn't used trial
  if (!trialStatus.isInTrial && !trialStatus.hasUsedTrial) {
    return null
  }

  const isAboutToExpire = isTrialAboutToExpire(trialStatus.trialEndDate)

  const renderIndicator = () => {
    if (trialStatus.isInTrial) {
      // Active trial
      const badgeVariant = isAboutToExpire ? "destructive" : "secondary"
      const badgeClass = isAboutToExpire 
        ? "bg-orange-100 text-orange-800 border-orange-200" 
        : "bg-blue-100 text-blue-800 border-blue-200"

      switch (variant) {
        case "button":
          return (
            <Button
              variant="outline"
              size="sm"
              className={`${badgeClass} border`}
              onClick={onUpgradeClick}
            >
              <Clock className="h-3 w-3 mr-1" />
              {formatTrialDaysRemaining(trialStatus.daysRemaining)}
            </Button>
          )
        
        case "minimal":
          return (
            <span className={`text-xs font-medium ${isAboutToExpire ? "text-orange-600" : "text-blue-600"}`}>
              {formatTrialDaysRemaining(trialStatus.daysRemaining)}
            </span>
          )
        
        default:
          return (
            <Badge variant={badgeVariant} className={badgeClass}>
              <Clock className="h-3 w-3 mr-1" />
              {formatTrialDaysRemaining(trialStatus.daysRemaining)}
            </Badge>
          )
      }
    } else if (trialStatus.hasUsedTrial) {
      // Trial expired
      switch (variant) {
        case "button":
          return (
            <Button
              variant="outline"
              size="sm"
              className="bg-red-100 text-red-800 border-red-200 border"
              onClick={onUpgradeClick}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Teste Expirado
            </Button>
          )
        
        case "minimal":
          return (
            <span className="text-xs font-medium text-red-600">
              Teste Expirado
            </span>
          )
        
        default:
          return (
            <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Teste Expirado
            </Badge>
          )
      }
    }

    return null
  }

  const indicator = renderIndicator()

  if (!indicator) {
    return null
  }

  if (!showPopover) {
    return indicator
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {indicator}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {trialStatus.isInTrial ? (
              <Clock className="h-4 w-4 text-blue-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <h4 className="font-medium">
              {trialStatus.isInTrial ? "Período de Teste Ativo" : "Período de Teste Expirado"}
            </h4>
          </div>
          
          {trialStatus.isInTrial ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Você tem <strong>{formatTrialDaysRemaining(trialStatus.daysRemaining)}</strong> do seu período de teste gratuito.
              </p>
              
              {isAboutToExpire && (
                <p className="text-sm text-orange-600 font-medium">
                  ⚠️ Seu teste expira em breve! Considere fazer o upgrade para continuar usando as funcionalidades Pro.
                </p>
              )}
              
              <div className="text-xs text-muted-foreground">
                <p>Início: {trialStatus.trialStartDate?.toLocaleDateString("pt-BR")}</p>
                <p>Fim: {trialStatus.trialEndDate?.toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Seu período de teste gratuito expirou. Faça o upgrade para continuar usando as funcionalidades Pro.
              </p>
            </div>
          )}
          
          {onUpgradeClick && (
            <Button
              size="sm"
              className="w-full"
              onClick={onUpgradeClick}
            >
              <Crown className="h-4 w-4 mr-2" />
              {trialStatus.isInTrial ? "Fazer Upgrade" : "Upgrade Agora"}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}