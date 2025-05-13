"use server";

import { signOut } from "@/auth";
import { revalidatePath, revalidateTag } from "next/cache";

export const signOutAction = async () => {
	
	revalidatePath("/", "layout");
	revalidatePath("/organizations", "layout");
	revalidateTag("session");
	
	
	await new Promise((resolve) => setTimeout(resolve, 100));
	
	return await signOut({
		redirectTo: "/",
	});
};