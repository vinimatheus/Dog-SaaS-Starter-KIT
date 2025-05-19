"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { updateOrganizationAction } from "@/actions/update-organization.actions"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

const organizationFormSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .refine(value => value.trim().length >= 2, {
      message: "Nome não pode conter apenas espaços"
    })
})

type OrganizationFormValues = z.infer<typeof organizationFormSchema>

interface OrganizationFormProps {
  initialName: string
  uniqueOrgId: string
}

export function OrganizationForm({ initialName, uniqueOrgId }: OrganizationFormProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: initialName
    }
  })

  async function onSubmit(data: OrganizationFormValues) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("name", data.name)
      formData.append("uniqueOrgId", uniqueOrgId)

      const result = await updateOrganizationAction(formData)

      if (result.success) {
        toast.success("Nome da organização atualizado com sucesso.")
      } else {
        toast.error(result.error || "Erro ao atualizar nome da organização")
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Organização</FormLabel>
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
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>
    </Form>
  )
} 