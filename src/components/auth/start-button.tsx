"use client"

import { Button } from "@/components/ui/button"
import { Rocket, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"

type StartButtonProps = {
  variant?: "default" | "sm" | "lg"
  className?: string
}

export function StartButton({ variant = "lg", className = "text-lg px-8 py-6" }: StartButtonProps) {
  const { status } = useSession()

  const buttonSize = variant === "sm" ? "sm" : "lg"
  const showIcons = variant !== "sm"

  return (
    <Button size={buttonSize} className={className} asChild>
      <Link href={status === "authenticated" ? "/organizations" : "/login"} className="flex items-center space-x-2">
        {showIcons && <Rocket className="h-5 w-5" />}
        <span>{status === "authenticated" ? "Minhas Organizações" : "Começar"}</span>
        {showIcons && <ArrowRight className="h-4 w-4" />}
      </Link>
    </Button>
  )
} 