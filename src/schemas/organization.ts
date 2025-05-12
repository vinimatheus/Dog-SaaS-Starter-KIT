import * as z from "zod";

export const CreateOrganizationSchema = z.object({
  name: z.string()
    .min(1, "O nome é obrigatório")
    .max(50, "O nome deve ter no máximo 50 caracteres")
});

export type CreateOrganizationValues = z.infer<typeof CreateOrganizationSchema>; 