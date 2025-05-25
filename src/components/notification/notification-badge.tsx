"use client";

import { useEffect, useState } from "react";
import { countUnreadNotificationsAction } from "@/actions/notification.actions";

export function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const result = await countUnreadNotificationsAction();
        setCount(result.count);
      } catch (error) {
        console.error("Erro ao buscar contagem de notificações:", error);
      }
    };

    fetchCount();
    
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs rounded-full">
      {count > 9 ? "9+" : count}
    </span>
  );
} 