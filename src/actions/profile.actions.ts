"use server";

import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLogger } from "@/lib/audit-logger";

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
			await auditLogger.logSecurityViolation(undefined, "User not authenticated", {
				action: "updateProfile",
				organizationUniqueId: orgUniqueId
			});
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
			await auditLogger.logPermissionDenied(session.user.id, "updateProfile", "organization", undefined, undefined, {
				organizationUniqueId: orgUniqueId
			});
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

		await auditLogger.logEvent("profile_update", {
			userId: session.user.id,
			metadata: {
				organizationUniqueId: orgUniqueId,
				newName: validatedData.name,
				action: "updateProfile"
			}
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
		const userId = await auth().then(s => s?.user?.id).catch(() => undefined);
		
		if (error instanceof z.ZodError) {
			await auditLogger.logValidationFailure(userId, "updateProfile", error.errors, {
				organizationUniqueId: orgUniqueId
			});
			return {
				success: false,
				error: error.errors[0].message
			};
		}

		await auditLogger.logSystemError(userId, error instanceof Error ? error : new Error("Unknown error"), "updateProfile", {
			organizationUniqueId: orgUniqueId
		});

		return {
			success: false,
			error: "Erro ao atualizar perfil"
		};
	}
} 