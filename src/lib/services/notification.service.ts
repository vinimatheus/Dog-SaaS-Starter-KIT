import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkedEntity?: string;
  entityType?: string;
}

export class NotificationService {
  static async createNotification({
    userId,
    title,
    message,
    type,
    linkedEntity,
    entityType,
  }: CreateNotificationParams) {
    try {
      if (!userId) {
        console.warn("[NotificationService] Tentativa de criar notificação sem usuário");
        return null;
      }
      
      return await prisma.notification.create({
        data: {
          user_id: userId,
          title,
          message,
          type,
          linked_entity: linkedEntity,
          entity_type: entityType,
        },
      });
    } catch (error) {
      console.error("[NotificationService] Error creating notification:", error);
      return null;
    }
  }

  static async getUnreadNotifications(userId: string) {
    try {
      return await prisma.notification.findMany({
        where: {
          user_id: userId,
          read: false,
        },
        orderBy: {
          created_at: "desc",
        },
      });
    } catch (error) {
      console.error("[NotificationService] Error getting unread notifications:", error);
      return [];
    }
  }

  static async getRecentNotifications(userId: string, limit = 10) {
    try {
      return await prisma.notification.findMany({
        where: {
          user_id: userId,
        },
        orderBy: {
          created_at: "desc",
        },
        take: limit,
      });
    } catch (error) {
      console.error("[NotificationService] Error getting recent notifications:", error);
      return [];
    }
  }

  static async markAsRead(notificationId: string) {
    try {
      return await prisma.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          read: true,
        },
      });
    } catch (error) {
      console.error("[NotificationService] Error marking notification as read:", error);
      return {};
    }
  }

  static async markAllAsRead(userId: string) {
    try {
      return await prisma.notification.updateMany({
        where: {
          user_id: userId,
          read: false,
        },
        data: {
          read: true,
        },
      });
    } catch (error) {
      console.error("[NotificationService] Error marking all notifications as read:", error);
      return { count: 0 };
    }
  }
  
  static async countUnread(userId: string) {
    try {
      return await prisma.notification.count({
        where: {
          user_id: userId,
          read: false,
        },
      });
    } catch (error) {
      console.error("[NotificationService] Error counting unread notifications:", error);
      return 0;
    }
  }
} 