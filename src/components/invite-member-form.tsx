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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    try {
      startTransition(async () => {
        const formData = new FormData();
        formData.append("email", values.email);
        formData.append("role", values.role);
        formData.append("organizationId", organizationId);
        
        const result = await inviteMemberAction(formData);
        
        if (result?.success) {
          toast.success("Convite enviado com sucesso!");
          form.reset();
          onSuccess?.();
        } else {
          throw new Error("Erro ao enviar convite");
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erro ao enviar convite");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    form.handleSubmit(
      (data) => onSubmit(data),
      () => toast.error('Por favor, corrija os erros no formulário')
    )(e);
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Form {...form}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email do membro</FormLabel>
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
                  />
                </FormControl>
                <FormDescription>
                  O membro receberá um email com o convite para participar da organização.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo</FormLabel>
                <Select
                  disabled={isPending}
                  onValueChange={(value: Role) => {
                    field.onChange(value);
                    form.trigger('role');
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="USER">Membro</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Defina as permissões iniciais do membro na organização.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            disabled={isPending} 
            type="submit" 
            className="w-full"
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
                Enviando...
              </span>
            ) : (
              "Enviar convite"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
} 