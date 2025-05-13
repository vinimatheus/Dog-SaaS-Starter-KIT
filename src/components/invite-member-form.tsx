"use client";

import * as z from 'zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Role } from '@prisma/client';

import { inviteMemberAction } from '@/actions/invite-member.actions';

const InviteMemberSchema = z.object({
  email: z.string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
  role: z.enum(["USER", "ADMIN"] as const, {
    required_error: "Selecione um cargo",
  })
});

type InviteMemberValues = z.infer<typeof InviteMemberSchema>;

interface InviteMemberFormProps extends React.ComponentPropsWithoutRef<'div'> {
  organizationId: string;
  onSuccess?: () => void;
}

export function InviteMemberForm({ 
  organizationId,
  className,
  onSuccess,
  ...props 
}: InviteMemberFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<InviteMemberValues>({
    resolver: zodResolver(InviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'USER'
    },
    mode: 'onChange'
  });

  const onSubmit = async (values: InviteMemberValues) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("email", values.email);
        formData.append("role", values.role);
        formData.append("organizationId", organizationId);
        
        // Toast de carregamento
        const toastId = toast.loading('Enviando convite...');
        
        // Chamar action
        const result = await inviteMemberAction(formData);
        
        if (result.success) {
          // Atualizar toast para sucesso
          toast.success('Convite enviado com sucesso!', { 
            id: toastId,
            description: `Um email foi enviado para ${values.email}`
          });
          form.reset();
          onSuccess?.();
        } else {
          // Atualizar toast para erro
          toast.error('Falha ao enviar convite', { 
            id: toastId,
            description: result.error || 'Ocorreu um erro inesperado'
          });
        }
      } catch (error) {
        // Erro não tratado
        toast.error('Erro ao processar o convite', {
          description: error instanceof Error 
            ? error.message 
            : 'Ocorreu um erro inesperado ao processar seu convite'
        });
      }
    });
  };

  return (
    <div className={cn('flex flex-col w-full', className)} {...props}>
      <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 w-full">
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full">
            <div className="flex flex-row gap-4 w-full">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
                  <FormItem className="w-3/4">
                    <FormLabel className="text-sm text-muted-foreground">Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="membro@exemplo.com"
                    disabled={isPending}
                    onChange={(e) => {
                      field.onChange(e);
                      form.trigger('email');
                    }}
                        className="text-sm w-full h-9"
                  />
                </FormControl>
                    <FormDescription className="text-xs text-muted-foreground">
                      Enviaremos um convite para esse endereço.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
                  <FormItem className="w-1/4">
                    <FormLabel className="text-sm text-muted-foreground">Cargo</FormLabel>
                <Select
                  disabled={isPending}
                  onValueChange={(value: Role) => {
                    field.onChange(value);
                    form.trigger('role');
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                        <SelectTrigger className="text-sm h-9 w-full">
                          <SelectValue placeholder="Cargo" />
                    </SelectTrigger>
                  </FormControl>
                      <SelectContent className="text-sm">
                    <SelectItem value="USER">Membro</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                    <FormDescription className="text-xs text-muted-foreground">
                      Define permissões.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
            </div>

            <div className="flex justify-end w-full">
          <Button 
            disabled={isPending} 
            type="submit" 
                size="sm"
                className="text-sm px-6"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-muted-foreground" viewBox="0 0 24 24">
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
                Enviando...
              </span>
            ) : (
              "Enviar convite"
            )}
          </Button>
            </div>
        </form>
      </Form>
      </div>
    </div>
  );
} 
