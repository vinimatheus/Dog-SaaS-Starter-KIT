'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function MembersErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro na página de membros:', error)
    
    toast.error('Ocorreu um erro na página de membros', {
      description: error.message || 'Não foi possível carregar a lista de membros.',
    })
  }, [error])

  return (
    <div className="mx-auto flex flex-col items-center justify-center py-10">
      <div className="bg-card rounded-md border border-muted p-6 max-w-md w-full text-center">
        <div className="flex justify-center">
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
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Erro ao carregar membros</h2>
        <p className="text-muted-foreground mb-6">
          Não foi possível carregar a lista de membros da organização.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => reset()} variant="default" className="w-full">
            Tentar novamente
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/organizations">
              Voltar para Organizações
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
} 