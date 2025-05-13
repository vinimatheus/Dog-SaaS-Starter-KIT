'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Registrar o erro no console ou em um serviço de monitoramento
    console.error('Erro crítico na aplicação:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex h-screen w-full flex-col items-center justify-center">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-red-500 mb-4"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h2 className="text-2xl font-bold tracking-tight">Erro Crítico</h2>
            <p className="mt-2 text-muted-foreground">
              A aplicação encontrou um erro crítico e não pode continuar.
            </p>
            <div className="mt-6">
              <Button onClick={() => reset()} variant="default">
                Tentar novamente
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
} 