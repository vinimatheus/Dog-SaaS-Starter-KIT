"use client"

import * as z from "zod"
import { useState, useEffect } from "react"
import { signIn, getCsrfToken } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dog } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const loginSchema = z.object({
  email: z.string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [isLoading, setIsLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  // Carregar token CSRF ao montar o componente
  useEffect(() => {
    const loadCsrfToken = async () => {
      const token = await getCsrfToken()
      setCsrfToken(token)
    }
    loadCsrfToken()
  }, [])

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
    },
    mode: "onChange",
  })

  const onSubmit = async (values: LoginValues) => {
    if (!csrfToken) {
      setError("Erro de segurança: Token CSRF não encontrado")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("resend", {
        email: values.email,
        redirect: false,
        callbackUrl: "/organizations",
        csrfToken,
      })

      if (result?.error) {
        if (result.error === "CSRF") {
          setError("Erro de segurança. Por favor, recarregue a página e tente novamente.")
        } else {
          setError(result.error)
        }
        return
      }

      setMagicLinkSent(true)
    } catch (error) {
      console.error("Erro ao enviar magic link:", error)
      setError("Erro ao enviar magic link. Tente novamente mais tarde.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!csrfToken) {
      setError("Erro de segurança: Token CSRF não encontrado")
      return
    }
    await signIn("google", { 
      redirectTo: "/organizations",
      csrfToken, // Adicionar token CSRF explicitamente
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2">
        <a
          href="#"
          className="flex flex-col items-center gap-2 font-medium"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md">
            <Dog className="size-6" />
          </div>
          <span className="sr-only">Dog Inc.</span>
        </a>
        <h1 className="text-xl font-bold">Bem vindo ao Dog Inc.</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="m@example.com"
                    disabled={isLoading || magicLinkSent}
                    onChange={(e) => {
                      field.onChange(e)
                      form.trigger("email")
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {magicLinkSent ? (
            <div className="text-center text-sm text-green-600">
              Magic link enviado! Verifique seu email.
            </div>
          ) : (
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Enviando...
                </span>
              ) : (
                "Enviar Magic Link"
              )}
            </Button>
          )}
        </form>
      </Form>

      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">
          Ou
        </span>
      </div>
      
      <div className="grid gap-4">
        <Button 
          onClick={handleGoogleSignIn}
          variant="outline" 
          className="w-full"
          disabled={isLoading || magicLinkSent}
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          Continuar com Google
        </Button>
      </div>

      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        Ao clicar em continuar, você concorda com nossos <a href="#">Termos de Serviço</a>{" "}
        e <a href="#">Política de Privacidade</a>.
      </div>
    </div>
  )
}
