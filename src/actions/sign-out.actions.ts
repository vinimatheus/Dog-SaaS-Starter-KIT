"use server";

import { signOut } from "@/auth";
import { revalidatePath, revalidateTag } from "next/cache";

export const signOutAction = async () => {
	// Força revalidação de todas as rotas
	revalidatePath("/", "layout");
	revalidatePath("/organizations", "layout");
	revalidateTag("session");
	
	// Aguarda um momento para garantir que o cache seja limpo
	await new Promise((resolve) => setTimeout(resolve, 100));
	
	return await signOut({
		redirectTo: "/",
	});
};