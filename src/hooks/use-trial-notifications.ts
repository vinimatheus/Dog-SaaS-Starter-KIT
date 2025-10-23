"use client"

import { useState, useEffect } from "react"
import { TrialStatus } from "@/types/stripe"

interface TrialNotificationState {
  showTrialCountdown: boolean
  showTrialExpired: boolean
  showConversionSuccess: boolean
  lastDismissedAt: number | null
}

const STORAGE_KEY = "trial-notifications"
const DISMISS_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export function useTrialNotifications(organizationId: string, trialStatus: TrialStatus | null) {
  const [notificationState, setNotificationState] = useState<TrialNotificationState>({
    showTrialCountdown: true,
    showTrialExpired: true,
    showConversionSuccess: false,
    lastDismissedAt: null
  })

  // Load notification state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${organizationId}`)
      if (stored) {
        const parsedState = JSON.parse(stored) as TrialNotificationState
        
        // Check if dismiss period has expired
        if (parsedState.lastDismissedAt) {
          const now = Date.now()
          const timeSinceDismiss = now - parsedState.lastDismissedAt
          
          if (timeSinceDismiss > DISMISS_DURATION) {
            // Reset dismiss state after 24 hours
            setNotificationState(prev => ({
              ...prev,
              showTrialCountdown: true,
              showTrialExpired: true,
              lastDismissedAt: null
            }))
          } else {
            setNotificationState(parsedState)
          }
        } else {
          setNotificationState(parsedState)
        }
      }
    } catch (error) {
      console.error("Error loading trial notification state:", error)
    }
  }, [organizationId])

  // Save notification state to localStorage
  const saveNotificationState = (newState: Partial<TrialNotificationState>) => {
    if (typeof window === "undefined") return

    const updatedState = { ...notificationState, ...newState }
    setNotificationState(updatedState)

    try {
      localStorage.setItem(`${STORAGE_KEY}-${organizationId}`, JSON.stringify(updatedState))
    } catch (error) {
      console.error("Error saving trial notification state:", error)
    }
  }

  // Dismiss trial countdown notification
  const dismissTrialCountdown = () => {
    saveNotificationState({
      showTrialCountdown: false,
      lastDismissedAt: Date.now()
    })
  }

  // Dismiss trial expired notification
  const dismissTrialExpired = () => {
    saveNotificationState({
      showTrialExpired: false,
      lastDismissedAt: Date.now()
    })
  }

  // Show conversion success notification
  const showConversionSuccess = () => {
    saveNotificationState({
      showConversionSuccess: true,
      showTrialCountdown: false,
      showTrialExpired: false
    })
  }

  // Dismiss conversion success notification
  const dismissConversionSuccess = () => {
    saveNotificationState({
      showConversionSuccess: false
    })
  }

  // Determine which notifications should be shown
  const shouldShowTrialCountdown = trialStatus?.isInTrial && notificationState.showTrialCountdown
  const shouldShowTrialExpired = trialStatus?.hasUsedTrial && !trialStatus.isInTrial && notificationState.showTrialExpired
  const shouldShowConversionSuccess = notificationState.showConversionSuccess

  return {
    shouldShowTrialCountdown,
    shouldShowTrialExpired,
    shouldShowConversionSuccess,
    dismissTrialCountdown,
    dismissTrialExpired,
    showConversionSuccess,
    dismissConversionSuccess
  }
}