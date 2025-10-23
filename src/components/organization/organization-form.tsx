"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateOrganizationAction } from "@/actions/update-organization.actions";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { NoSSR } from "@/components/ui/no-ssr";

const organizationFormSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .refine((value) => value.trim().length >= 2, {
      message: "Nome não pode conter apenas espaços",
    }),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

interface OrganizationFormProps {
  initialName: string;
  uniqueOrgId: string;
}

export function OrganizationForm({
  initialName,
  uniqueOrgId,
}: OrganizationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: initialName,
    },
  });

  async function onSubmit(data: OrganizationFormValues) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("name", data.name);
        formData.append("uniqueOrgId", uniqueOrgId);

        const result = await updateOrganizationAction(formData);

        if (result.success) {
          toast.success("Nome da organização atualizado com sucesso!");
          router.refresh();
        } else {
          toast.error(result.error || "Erro ao atualizar nome da organização");
        }
      } catch (error) {
        console.error("Erro ao atualizar organização:", error);
        toast.error("Erro ao atualizar nome da organização");
      }
    });
  }

  return (
    <NoSSR>
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
                    disabled={isPending}
                  />
                </FormControl>
                <FormDescription>
                  Este é o nome que será exibido para todos os membros da
                  organização.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-sm text-muted-foreground">
            <p>ID da Organização: {uniqueOrgId}</p>
            <p className="text-xs mt-1">
              O ID da organização não pode ser alterado.
            </p>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </Form>
    </NoSSR>
  );
}
