import { z } from "zod"

export const profileSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres")
})

export const organizationSchema = z.object({
  name: z.string().min(3, "O nome da organização deve ter pelo menos 3 caracteres")
}) 