"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { toast } from 'sonner';
import { GoogleIcon } from './provider-icons';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';

interface ClientAccountLinkingProps {
  userEmail: string;
  linkedProviders: string[];
}

export default function ClientAccountLinking({ userEmail, linkedProviders }: ClientAccountLinkingProps) {
  const [isLinking, setIsLinking] = useState(false);

  const isGoogleLinked = linkedProviders.includes('google');

  const handleLinkProvider = async (provider: string) => {
    setIsLinking(true);
    try {

      await signIn(provider, { 
        callbackUrl: window.location.href,
        redirect: true
      });
    } catch (error) {
      toast.error('Erro ao vincular conta', {
        description: error instanceof Error 
          ? error.message 
          : 'Ocorreu um erro ao tentar vincular sua conta'
      });
      setIsLinking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas vinculadas</CardTitle>
        <CardDescription>
          Vincule outras contas para facilitar seu login
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center space-x-4">
            <GoogleIcon className="h-6 w-6" />
            <div>
              <p className="text-sm font-medium">Google</p>
              <p className="text-xs text-muted-foreground">
                {isGoogleLinked ? 
                  "Conta Google vinculada" : 
                  "Vincule sua conta do Google para login mais rápido"}
              </p>
            </div>
          </div>
          <Button
            variant={isGoogleLinked ? "outline" : "default"}
            size="sm"
            disabled={isLinking || isGoogleLinked}
            onClick={() => handleLinkProvider('google')}
          >
            {isLinking ? "Vinculando..." : isGoogleLinked ? "Vinculado" : "Vincular"}
          </Button>
        </div>

        <div className="rounded-md bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            Ao vincular contas, você poderá fazer login com qualquer um dos provedores usando o mesmo email: <strong>{userEmail}</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 