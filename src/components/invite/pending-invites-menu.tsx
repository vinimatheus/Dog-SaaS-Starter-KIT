"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { getPendingInvitesForUserAction } from "@/actions/invite-member.actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PendingInvites } from "./pending-invites";
import { NoSSR } from "@/components/ui/no-ssr";

export function PendingInvitesMenu() {
  const [hasInvites, setHasInvites] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkPendingInvites = async () => {
    setIsLoading(true);
    try {
      const result = await getPendingInvitesForUserAction();
      if (result.success) {
        setHasInvites(result.invites.length > 0);
      }
    } catch (error) {
      console.error("Erro ao verificar convites pendentes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkPendingInvites();
    
    const interval = setInterval(checkPendingInvites, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!hasInvites && !isLoading) return null;

  return (
    <NoSSR>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Mail className="h-5 w-5" />
                {hasInvites && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-blue-500 text-white text-xs rounded-full">
                    !
                  </span>
                )}
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-w-[90vw]">
          <div className="p-2">
            <PendingInvites onInviteProcessed={checkPendingInvites} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </NoSSR>
  );
} 