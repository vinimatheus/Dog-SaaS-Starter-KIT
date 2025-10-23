"use client"

import { useEffect, useState } from "react"
import { TrialNotifications, TrialConversionSuccess } from "./trial-notifications"
import { useTrialNotifications } from "@/hooks/use-trial-notifications"
import { getTrialStatusAction } from "@/actions/stripe.actions"
import { TrialStatus } from "@/types/stripe"

interface TrialNotificationManagerProps {
  organizationId: string
  onUpgradeClick?: () => void
  className?: string
}

export function TrialNotificationManager({
  organizationId,
  onUpgradeClick,
  className = ""
}: TrialNotificationManagerProps) {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const {
    shouldShowTrialCountdown,
    shouldShowTrialExpired,
    shouldShowConversionSuccess,
    dismissTrialCountdown,
    dismissTrialExpired,
    dismissConversionSuccess
  } = useTrialNotifications(organizationId, trialStatus)

  // Load trial status
  useEffect(() => {
    const loadTrialStatus = async () => {
      try {
        const status = await getTrialStatusAction(organizationId)
        setTrialStatus(status)
      } catch (error) {
        console.error("Error loading trial status:", error)
        // Don't show error for permission issues
      } finally {
        setIsLoading(false)
      }
    }

    loadTrialStatus()
  }, [organizationId])

  if (isLoading || !trialStatus) {
    return null
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Trial countdown notification */}
      {shouldShowTrialCountdown && (
        <TrialNotifications
          trialStatus={trialStatus}
          onUpgradeClick={onUpgradeClick}
          onDismiss={dismissTrialCountdown}
          showDismiss={true}
        />
      )}

      {/* Trial expired notification */}
      {shouldShowTrialExpired && (
        <TrialNotifications
          trialStatus={trialStatus}
          onUpgradeClick={onUpgradeClick}
          onDismiss={dismissTrialExpired}
          showDismiss={true}
        />
      )}

      {/* Conversion success notification */}
      {shouldShowConversionSuccess && (
        <TrialConversionSuccess
          onDismiss={dismissConversionSuccess}
        />
      )}
    </div>
  )
}