"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { profileSchema, organizationSchema } from "@/schemas/onboarding"
import { updateProfile, createOrganization, completeOnboarding } from "@/actions/onboarding.actions"
import { toast } from "sonner"

type ProfileFormData = {
  name: string
}

type OrganizationFormData = {
  name: string
}

type OnboardingFormProps = {
  initialName: string
}

export function OnboardingForm({ initialName }: OnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState(0)
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
      name: `${profileForm.getValues("name")}'s Organization`
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
      setIsLoading(true)
      // Primeiro atualiza o perfil
      await updateProfile(profileForm.getValues())
      // Depois cria a organização
      const org = await createOrganization(data)
      // Por fim, redireciona para a organização
      await completeOnboarding(org.id)
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
            }
          }}
          disabled={isLoading}
        >
          {currentStep === steps.length ? (
            <>
              {isLoading ? "Processando..." : "Finalizar"}
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