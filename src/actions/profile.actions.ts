"use server";

import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateProfileSchema = z.object({
	name: z.string().min(2, {
		message: "O nome deve ter pelo menos 2 caracteres.",
	}),
});

interface UpdateProfileResult {
	success: boolean;
	error?: string;
	user?: {
		id: string;
		name: string | null;
	};
}

export async function updateProfile(
	orgUniqueId: string,
	data: z.infer<typeof updateProfileSchema>
): Promise<UpdateProfileResult> {
	try {
		const session = await auth();

		if (!session?.user?.id) {
			return {
				success: false,
				error: "Não autorizado"
			};
		}

		const userOrg = await prisma.user_Organization.findFirst({
			where: {
				user_id: session.user.id,
				organization: {
					uniqueId: orgUniqueId
				}
			}
		});

		if (!userOrg) {
			return {
				success: false,
				error: "Não autorizado"
			};
		}

		const validatedData = updateProfileSchema.parse(data);

		const updatedUser = await prisma.user.update({
			where: {
				id: session.user.id,
			},
			data: {
				name: validatedData.name,
				sessionVersion: { increment: 1 }
			},
		});

		await unstable_update({
			user: {
				name: updatedUser.name,
			},
		});

		revalidatePath(`/${orgUniqueId}/config/profile`);
		revalidatePath("/", "layout");

		return {
			success: true,
			user: {
				id: updatedUser.id,
				name: updatedUser.name,
			},
		};
	} catch (error) {
		console.error("[PROFILE_UPDATE]", error);

		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.errors[0].message
			};
		}

		return {
			success: false,
			error: "Erro ao atualizar perfil"
		};
	}
} 