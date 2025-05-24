"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { profileSchema, organizationSchema, planSchema } from "@/schemas/onboarding"
import { updateProfile, createOrganization, completeOnboarding, redirectToCheckout } from "@/actions/onboarding.actions"
import { toast } from "sonner"
import { PlanType } from "@prisma/client"

type ProfileFormData = {
  name: string
}

type OrganizationFormData = {
  name: string
  plan: PlanType
}

type PlanFormData = {
  plan: PlanType
}

type OnboardingFormProps = {
  initialName: string
}

export function OnboardingForm({ initialName }: OnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState(0)
  const [organizationId, setOrganizationId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialName
    }
  })

  const organizationForm = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: `${profileForm.getValues("name")}'s Organization`,
      plan: PlanType.FREE
    }
  })

  const planForm = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      plan: PlanType.FREE
    }
  })

  // Atualiza o nome da organização quando o nome do usuário mudar
  useEffect(() => {
    const subscription = profileForm.watch((value) => {
      if (value.name) {
        organizationForm.setValue("name", `${value.name}'s Organization`)
      }
    })
    return () => subscription.unsubscribe()
  }, [profileForm, organizationForm])

  // Atualiza o plano da organização quando o plano mudar
  useEffect(() => {
    const subscription = planForm.watch((value) => {
      if (value.plan) {
        organizationForm.setValue("plan", value.plan)
      }
    })
    return () => subscription.unsubscribe()
  }, [planForm, organizationForm])

  const steps = [
    {
      id: 1,
      title: "Seu Perfil",
      description: "Informe seu nome para começarmos",
      content: (
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Digite seu nome" 
                      className="border-primary/20 focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      )
    },
    {
      id: 2,
      title: "Sua Organização",
      description: "Crie sua primeira organização",
      content: (
        <Form {...organizationForm}>
          <form onSubmit={organizationForm.handleSubmit(onOrganizationSubmit)} className="space-y-4">
            <FormField
              control={organizationForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da organização</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Digite o nome da organização"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      )
    },
    {
      id: 3,
      title: "Escolha seu Plano",
      description: "Selecione o plano que melhor atende suas necessidades",
      content: (
        <Form {...planForm}>
          <form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div 
                className={cn(
                  "relative rounded-lg border p-4 cursor-pointer transition-all",
                  planForm.watch("plan") === PlanType.FREE 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => planForm.setValue("plan", PlanType.FREE)}
              >
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold">Plano Free</h3>
                  <p className="text-sm text-muted-foreground">
                    Perfeito para começar
                  </p>
                  <ul className="text-sm space-y-2 mt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Até 3 membros</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Funcionalidades básicas</span>
                    </li>
                  </ul>
                </div>
                {planForm.watch("plan") === PlanType.FREE && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
              </div>

              <div 
                className={cn(
                  "relative rounded-lg border p-4 cursor-pointer transition-all",
                  planForm.watch("plan") === PlanType.PRO 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => planForm.setValue("plan", PlanType.PRO)}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Plano Pro</h3>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Para equipes maiores
                  </p>
                  <ul className="text-sm space-y-2 mt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Membros ilimitados</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Convites em massa</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Recursos avançados</span>
                    </li>
                  </ul>
                </div>
                {planForm.watch("plan") === PlanType.PRO && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
              </div>
            </div>
          </form>
        </Form>
      )
    }
  ]

  const currentStepData = steps.find(step => step.id === currentStep)

  async function onProfileSubmit(data: ProfileFormData) {
    try {
      await updateProfile(data)
      handleNext()
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err)
      toast.error("Erro ao atualizar perfil. Tente novamente.")
    }
  }

  async function onOrganizationSubmit(data: OrganizationFormData) {
    try {
      const org = await createOrganization(data)
      setOrganizationId(org.id)
      handleNext()
    } catch (err) {
      console.error("Erro ao criar organização:", err)
      toast.error("Erro ao criar organização. Tente novamente.")
    }
  }

  async function onPlanSubmit(data: PlanFormData) {
    try {
      if (!organizationId) {
        throw new Error("ID da organização não encontrado")
      }

      setIsLoading(true)
      if (data.plan === PlanType.PRO) {
        await redirectToCheckout(organizationId)
      } else {
        await completeOnboarding(organizationId)
      }
    } catch (err: unknown) {
      // Se for um erro de redirecionamento do Next.js, não mostra o toast
      if (err && typeof err === 'object' && 'digest' in err && 
          typeof err.digest === 'string' && err.digest.startsWith('NEXT_REDIRECT')) {
        return
      }
      
      console.error("Erro ao finalizar onboarding:", err)
      toast.error("Erro ao finalizar onboarding. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNext = () => {
    setDirection(1)
    setCurrentStep(prev => Math.min(prev + 1, steps.length))
  }

  const handleBack = () => {
    setDirection(-1)
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 20 : -20,
      opacity: 0,
      scale: 0.95
    })
  }

  return (
    <>
      {/* Steps */}
      <div className="flex justify-center space-x-4 mb-8">
        {steps.map((step) => (
          <motion.div 
            key={step.id} 
            className="flex items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: step.id * 0.1 }}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
              step.id === currentStep 
                ? "border-primary bg-primary text-primary-foreground scale-110" 
                : step.id < currentStep
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted-foreground/20 bg-muted/5"
            )}>
              {step.id < currentStep ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <span className="text-sm font-semibold">{step.id}</span>
              )}
            </div>
            {step.id < steps.length && (
              <div className={cn(
                "w-16 h-[2px] transition-colors duration-200",
                step.id < currentStep 
                  ? "bg-primary" 
                  : "bg-muted-foreground/20"
              )} />
            )}
          </motion.div>
        ))}
      </div>

      {/* Current Step Card */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 400, damping: 30 },
              opacity: { duration: 0.2 },
              scale: { type: "spring", stiffness: 400, damping: 30 }
            }}
            className="origin-center"
          >
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-primary">{currentStep}.</span>
                  {currentStepData?.title}
                </CardTitle>
                <CardDescription>
                  {currentStepData?.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentStepData?.content}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        {currentStep > 1 && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleBack}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        )}
        <Button 
          size="sm" 
          variant="default"
          onClick={() => {
            switch (currentStep) {
              case 1:
                profileForm.handleSubmit(onProfileSubmit)()
                break
              case 2:
                organizationForm.handleSubmit(onOrganizationSubmit)()
                break
              case 3:
                planForm.handleSubmit(onPlanSubmit)()
                break
            }
          }}
          disabled={isLoading}
        >
          {currentStep === steps.length ? (
            <>
              {isLoading ? (
                "Processando..."
              ) : planForm.watch("plan") === PlanType.PRO ? (
                "Ir para Pagamento"
              ) : (
                "Finalizar"
              )}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </>
  )
} 