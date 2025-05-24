"use client";

import * as z from 'zod';
import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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

import { updateProfileAction } from '@/actions/update-profile.actions';


const isSafeRedirect = (url: string) => {
  try {
    
    if (url.startsWith('/')) {
      return true;
    }
    
    
    const parsedUrl = new URL(url, window.location.origin);
    return parsedUrl.origin === window.location.origin;
  } catch {
    return false;
  }
};

const CompleteProfileSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome deve ter no máximo 50 caracteres")
    .refine(name => name.trim().length > 0, "Nome é obrigatório")
});

type CompleteProfileValues = z.infer<typeof CompleteProfileSchema>;

interface CompleteProfileFormProps extends React.ComponentPropsWithoutRef<'div'> {
  returnTo: string;
  email?: string | null;
}

export function CompleteProfileForm({ 
  returnTo,
  email,
  className,
  ...props 
}: CompleteProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CompleteProfileValues>({
    resolver: zodResolver(CompleteProfileSchema),
    defaultValues: {
      name: '',
    },
    mode: 'onChange'
  });

  const onSubmit = async (values: CompleteProfileValues) => {
    startTransition(async () => {
      try {
        
        const toastId = toast.loading('Atualizando seu perfil...');
        
        const formData = new FormData();
        formData.append("name", values.name);
        
        const result = await updateProfileAction(formData);
        
        if (result.success) {
          
          toast.success('Perfil atualizado com sucesso!', {
            id: toastId,
            description: `Bem-vindo, ${result.updatedName || values.name}!`
          });
          
          console.log("Profile update successful:", result);
          
          
          setTimeout(() => {
            if (isSafeRedirect(returnTo)) {
              
              router.push(returnTo);
            } else {
              
              console.warn("Unsafe redirect URL detected, using fallback route");
              router.push('/organizations');
            }
          }, 1000);
        } else {
          console.error("Profile update failed:", result);
          
          
          toast.error('Falha ao atualizar perfil', { 
            id: toastId,
            description: result.error || 'Ocorreu um erro inesperado'
          });
        }
      } catch (error) {
        console.error("Error during profile update:", error);
        
        
        toast.error('Erro ao processar a atualização', {
          description: error instanceof Error 
            ? error.message 
            : 'Ocorreu um erro inesperado ao atualizar seu perfil'
        });
      }
    });
  };

  
  useEffect(() => {
    const refreshSession = () => {
      router.refresh();
    };
    
    return () => {
      refreshSession();
    };
  }, [router]);

  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <div className="bg-card rounded-md border border-muted p-6 w-full">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {email && (
              <div className="text-sm text-muted-foreground pb-2">
                <span>Conta vinculada a: </span>
                <span className="font-semibold">{email}</span>
              </div>
            )}
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Seu nome completo"
                      disabled={isPending}
                      onChange={(e) => {
                        field.onChange(e);
                        form.trigger('name');
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Este nome será exibido para outros usuários
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              disabled={isPending} 
              type="submit" 
              className="w-full mt-4" 
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
                "Completar perfil e continuar"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
} 