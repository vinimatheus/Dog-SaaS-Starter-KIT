"use server"

import { auth } from "@/auth"
import { NotificationService } from "@/lib/services/notification.service"
import { Notification } from "@prisma/client"
import { revalidatePath } from "next/cache"

interface NotificationsResult {
  success: boolean
  error?: string
  notifications?: Notification[]
}

export async function getUnreadNotificationsAction(): Promise<NotificationsResult> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: "Usuário não autenticado" }
    }
    
    const notifications = await NotificationService.getUnreadNotifications(session.user.id)
    return { success: true, notifications }
  } catch (error) {
    console.error("[GetUnreadNotifications]", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao buscar notificações" 
    }
  }
}

export async function getRecentNotificationsAction(limit?: number): Promise<NotificationsResult> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: "Usuário não autenticado" }
    }
    
    const notifications = await NotificationService.getRecentNotifications(session.user.id, limit)
    return { success: true, notifications }
  } catch (error) {
    console.error("[GetRecentNotifications]", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao buscar notificações recentes" 
    }
  }
}

export async function markNotificationAsReadAction(notificationId: string): Promise<{ success: boolean, error?: string }> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: "Usuário não autenticado" }
    }
    
    await NotificationService.markAsRead(notificationId)
    revalidatePath("/organizations")
    revalidatePath("/")
    
    return { success: true }
  } catch (error) {
    console.error("[MarkNotificationAsRead]", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao marcar notificação como lida" 
    }
  }
}

export async function markAllAsReadAction(): Promise<{ success: boolean, error?: string }> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: "Usuário não autenticado" }
    }
    
    await NotificationService.markAllAsRead(session.user.id)
    revalidatePath("/organizations")
    revalidatePath("/")
    
    return { success: true }
  } catch (error) {
    console.error("[MarkAllNotificationsAsRead]", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao marcar todas as notificações como lidas" 
    }
  }
}

export async function countUnreadNotificationsAction(): Promise<{ count: number }> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { count: 0 }
    }
    
    const count = await NotificationService.countUnread(session.user.id)
    return { count }
  } catch (error) {
    console.error("[CountUnreadNotifications]", error)
    return { count: 0 }
  }
} 