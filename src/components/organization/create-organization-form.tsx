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
    console.log('onSubmit chamado com valores:', values);
    try {
      startTransition(async () => {
        console.log('Iniciando criação da organização:', values);
        const formData = new FormData();
        formData.append("name", values.name);
        
        console.log('Chamando createOrganizationAction...');
        await createOrganizationAction(formData);
        console.log('Organização criada com sucesso!');
        onSuccess?.();
      });
    } catch (error) {
      console.error('Erro ao criar organização:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Algo deu errado ao criar a organização");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form submit event triggered');
    console.log('Form state:', form.getValues());
    console.log('Form errors:', form.formState.errors);
    
    form.handleSubmit(
      (data) => {
        console.log('Form valid, submitting:', data);
        onSubmit(data);
      },
      (errors) => {
        console.log('Form validation failed:', errors);
        toast.error('Por favor, corrija os erros no formulário');
      }
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
                      console.log('Input onChange:', e.target.value);
                      field.onChange(e);
                      // Força validação após mudança
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
            onClick={() => console.log('Button clicked')}
          >
            {isPending ? "Criando..." : "Criar Organização"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default CreateOrganizationForm; 