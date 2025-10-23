import { z } from "zod"
import { NameSchema, OrganizationNameSchema } from "./security"

export const profileSchema = z.object({
  name: NameSchema.refine((name: string) => name.length >= 3, "O nome deve ter pelo menos 3 caracteres")
})

export const organizationSchema = z.object({
  name: OrganizationNameSchema.refine((name: string) => name.length >= 3, "O nome da organização deve ter pelo menos 3 caracteres")
}) 