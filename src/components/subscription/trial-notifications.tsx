"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertTriangle, CheckCircle, Crown, X } from "lucide-react"
import { useState } from "react"
import { TrialStatus } from "@/types/stripe"
import { formatTrialDaysRemaining, isTrialAboutToExpire } from "@/lib/trial-utils"

interface TrialNotificationsProps {
  trialStatus: TrialStatus
  onUpgradeClick?: () => void
  onDismiss?: () => void
  showDismiss?: boolean
}

export function TrialNotifications({
  trialStatus,
  onUpgradeClick,
  onDismiss,
  showDismiss = false
}: TrialNotificationsProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  if (isDismissed) {
    return null
  }

  // Trial countdown notification (active trial)
  if (trialStatus.isInTrial) {
    const isAboutToExpire = isTrialAboutToExpire(trialStatus.trialEndDate)
    
    return (
      <Alert className={`relative ${isAboutToExpire ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50"}`}>
        {showDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        <Clock className={`h-4 w-4 ${isAboutToExpire ? "text-orange-600" : "text-blue-600"}`} />
        <AlertDescription className={isAboutToExpire ? "text-orange-800" : "text-blue-800"}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Teste Ativo
                </Badge>
                <span className="font-medium">
                  {formatTrialDaysRemaining(trialStatus.daysRemaining)}
                </span>
              </div>
              
              {isAboutToExpire ? (
                <p className="text-sm">
                  Seu período de teste expira em breve! Faça o upgrade agora para continuar usando todas as funcionalidades Pro sem interrupção.
                </p>
              ) : (
                <p className="text-sm">
                  Aproveite todas as funcionalidades Pro durante seu período de teste gratuito.
                </p>
              )}
            </div>
            
            {onUpgradeClick && (
              <Button
                size="sm"
                className={isAboutToExpire ? "bg-orange-600 hover:bg-orange-700" : ""}
                onClick={onUpgradeClick}
              >
                <Crown className="h-4 w-4 mr-2" />
                {isAboutToExpire ? "Upgrade Agora" : "Fazer Upgrade"}
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Trial expiration warning (trial ended, no active subscription)
  if (trialStatus.hasUsedTrial && !trialStatus.isInTrial) {
    return (
      <Alert className="relative border-red-200 bg-red-50">
        {showDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="destructive">
                  Teste Expirado
                </Badge>
              </div>
              
              <p className="text-sm">
                Seu período de teste gratuito expirou. Faça o upgrade para o plano Pro para continuar usando as funcionalidades avançadas.
              </p>
            </div>
            
            {onUpgradeClick && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                onClick={onUpgradeClick}
              >
                <Crown className="h-4 w-4 mr-2" />
                Fazer Upgrade
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

interface TrialConversionSuccessProps {
  onDismiss?: () => void
  showConfetti?: boolean
}

export function TrialConversionSuccess({
  onDismiss,
  showConfetti = true
}: TrialConversionSuccessProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  if (isDismissed) {
    return null
  }

  return (
    <Alert className="relative border-green-200 bg-green-50">
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 h-6 w-6 p-0"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-green-100 text-green-800">
                Upgrade Concluído
              </Badge>
              <Crown className="h-4 w-4 text-green-600" />
            </div>
            
            <p className="text-sm">
              <strong>Parabéns!</strong> Seu upgrade para o plano Pro foi concluído com sucesso. Agora você tem acesso completo a todas as funcionalidades avançadas.
            </p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}

interface TrialCountdownBadgeProps {
  trialStatus: TrialStatus
  className?: string
}

export function TrialCountdownBadge({
  trialStatus,
  className = ""
}: TrialCountdownBadgeProps) {
  if (!trialStatus.isInTrial) {
    return null
  }

  const isAboutToExpire = isTrialAboutToExpire(trialStatus.trialEndDate)

  return (
    <Badge 
      variant={isAboutToExpire ? "destructive" : "secondary"}
      className={`${isAboutToExpire ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-blue-100 text-blue-800 border-blue-200"} ${className}`}
    >
      <Clock className="h-3 w-3 mr-1" />
      {formatTrialDaysRemaining(trialStatus.daysRemaining)}
    </Badge>
  )
}