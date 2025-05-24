"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { acceptInviteAction } from "@/actions/accept-invite.actions";

interface AcceptInviteFormProps {
  inviteId: string;
}

export function AcceptInviteForm({ inviteId }: AcceptInviteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAcceptInvite = () => {
    startTransition(async () => {
      const result = await acceptInviteAction(inviteId);
      
      if (result.success) {
      toast.success("Convite aceito com sucesso!");
        router.push(result.redirectUrl!);
      } else {
        toast.error(result.error || "Erro ao aceitar convite");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
        <Button
        onClick={handleAcceptInvite}
        disabled={isPending}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Aceitando...
          </>
        ) : (
          "Aceitar Convite"
        )}
        </Button>
      </div>
  );
} 