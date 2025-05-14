"use client";

import * as z from 'zod';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateProfileAction } from '@/actions/update-profile.actions';

const ProfileSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres')
    .refine(name => name.trim().length > 0, 'Nome é obrigatório')
});

type ProfileValues = z.infer<typeof ProfileSchema>;

interface ProfileFormProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  };
  orgUniqueId: string; // Maintained for future use but not currently used
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      name: user.name || '',
    },
    mode: 'onChange'
  });

  const onSubmit = (values: ProfileValues) => {
    startTransition(async () => {
      try {
        const toastId = toast.loading('Atualizando seu perfil...');
        
        const formData = new FormData();
        formData.append('name', values.name);
        
        const result = await updateProfileAction(formData);
        
        if (result.success) {
          toast.success('Perfil atualizado com sucesso!', {
            id: toastId,
            description: `Seu nome foi alterado para ${result.updatedName}`
          });
          
          // Recarregar a página para atualizar os dados na UI
          router.refresh();
        } else {
          toast.error('Falha ao atualizar perfil', {
            id: toastId,
            description: result.error || 'Ocorreu um erro inesperado'
          });
        }
      } catch (error) {
        toast.error('Erro ao processar a atualização', {
          description: error instanceof Error 
            ? error.message 
            : 'Ocorreu um erro inesperado ao atualizar seu perfil'
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Seu nome completo"
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isPending || !form.formState.isDirty}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Salvando...
              </span>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
} 