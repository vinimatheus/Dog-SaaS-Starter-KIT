import { Logo } from "@/components/ui/logo"
import { OnboardingForm } from "@/components/forms/onboarding-form"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { signOut } from "@/auth"

export default async function OnboardingPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true }
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-2xl py-10">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center mb-2">
              <Logo size="lg" />
            </div>
            <p className="text-muted-foreground">
              Vamos configurar seu perfil e criar sua organização
            </p>
          </div>

          {/* User Info */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <form action={async () => {
              "use server"
              await signOut()
            }}>
              <Button 
                type="submit"
                variant="ghost" 
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </form>
          </div>

          {/* Form */}
          <OnboardingForm initialName={user?.name || ""} />
        </div>
      </div>
    </div>
  )
} 