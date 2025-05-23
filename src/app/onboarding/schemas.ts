import { z } from "zod"
import { PlanType } from "@prisma/client"

export const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
})

export const organizationSchema = z.object({
  name: z.string().min(2, "Nome da organização deve ter pelo menos 2 caracteres").max(100, "Nome da organização deve ter no máximo 100 caracteres"),
  plan: z.nativeEnum(PlanType)
})

export const planSchema = z.object({
  plan: z.nativeEnum(PlanType)
}) 