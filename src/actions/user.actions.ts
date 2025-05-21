import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    redirect("/auth/login")
  }

  return session.user
} 