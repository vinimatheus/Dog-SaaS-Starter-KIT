'use client';

import * as z from 'zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { CreateOrganizationSchema } from '@/schemas/organization';
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

import { createOrganizationAction } from '@/actions/create-organization.actions';

interface CreateOrganizationFormProps extends React.ComponentPropsWithoutRef<'div'> {
  onSuccess?: () => void;
}

export function CreateOrganizationForm({
  className,
  onSuccess,
  ...props
}: CreateOrganizationFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof CreateOrganizationSchema>>({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      name: ''
    },
    mode: 'onChange'
  });

  const onSubmit = async (values: z.infer<typeof CreateOrganizationSchema>) => {
    try {
      startTransition(async () => {
        const formData = new FormData();
        formData.append("name", values.name);
        
        await createOrganizationAction(formData);
        onSuccess?.();
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Algo deu errado ao criar a organização");
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Organização</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={isPending}
                    placeholder="Minha Empresa"
                    onChange={(e) => {
                      field.onChange(e);
                      form.trigger('name');
                    }}
                  />
                </FormControl>
                <FormDescription>
                  O identificador único será gerado automaticamente a partir do nome.
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
            {isPending ? "Criando..." : "Criar Organização"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default CreateOrganizationForm; 