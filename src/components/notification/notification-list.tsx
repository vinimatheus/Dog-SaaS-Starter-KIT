"use client";

import { Notification } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { markNotificationAsReadAction } from "@/actions/notification.actions";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function NotificationList({ notifications, isLoading, onRefresh }: NotificationListProps) {
  const [isPending, startTransition] = useTransition();

  const handleMarkAsRead = (id: string) => {
    startTransition(async () => {
      await markNotificationAsReadAction(id);
      onRefresh();
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma notificação não lida
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "p-3 hover:bg-accent/50 cursor-pointer transition-colors",
            notification.read ? "opacity-60" : "font-medium"
          )}
          onClick={() => !notification.read && handleMarkAsRead(notification.id)}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{notification.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>
            <p className="text-sm mt-1 text-muted-foreground">
              {notification.message}
            </p>
            {!notification.read && (
              <div className="mt-2 flex justify-end">
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <span className="text-xs text-primary">Marcar como lida</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 