// Suprime warnings de hidratação específicos do Radix UI
export function suppressRadixHydrationWarnings() {
  if (typeof window !== 'undefined') {
    const originalError = console.error
    const originalWarn = console.warn

    console.error = (...args) => {
      const message = args[0]
      if (
        typeof message === 'string' && 
        (message.includes('Hydration failed') ||
         message.includes('server rendered HTML') ||
         message.includes('radix-') ||
         message.includes('aria-controls') ||
         message.includes('aria-describedby'))
      ) {
        return
      }
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      const message = args[0]
      if (
        typeof message === 'string' && 
        (message.includes('Hydration') ||
         message.includes('radix-'))
      ) {
        return
      }
      originalWarn.apply(console, args)
    }
  }
}

// Auto-executar no cliente
if (typeof window !== 'undefined') {
  suppressRadixHydrationWarnings()
}