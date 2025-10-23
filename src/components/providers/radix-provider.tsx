"use client"

import { useEffect } from "react"

export function RadixProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suprimir warnings de hidratação específicos do Radix UI
    const originalError = console.error
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' && 
        (args[0].includes('Hydration failed') || 
         args[0].includes('server rendered HTML') ||
         args[0].includes('radix'))
      ) {
        return
      }
      originalError.call(console, ...args)
    }

    return () => {
      console.error = originalError
    }
  }, [])

  return <>{children}</>
}