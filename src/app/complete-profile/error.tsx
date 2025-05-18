'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Dog } from 'lucide-react'

export default function CompleteProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro na página de completar perfil:', error)
    
    toast.error('Não foi possível completar o perfil', {
      description: error.message || 'Ocorreu um problema ao processar suas informações.',
    })
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Dog className="h-6 w-6 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight">Ops! Algo deu errado</h1>
        <p className="mt-2 text-muted-foreground">
          Não foi possível completar o seu perfil. Por favor, tente novamente.
        </p>
        
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => reset()} variant="default" className="w-full">
            Tentar novamente
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/organizations">
              Voltar para organizações
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
} 