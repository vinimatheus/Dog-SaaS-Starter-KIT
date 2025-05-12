"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

export const createOrganizationAction = async (formData: FormData) => {
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/");
	}

	const name = formData.get("name") as string;
	
	if (!name) {
		throw new Error("Nome da organização é obrigatório");
	}

	const baseSlug = name.toLowerCase().replace(/[^a-z0-9-]/g, "");
	let uniqueId = baseSlug;
	let counter = 1;

	while (true) {
		const existingOrg = await prisma.organization.findUnique({
			where: { uniqueId },
		});

		if (!existingOrg) {
			break;
		}

		uniqueId = `${baseSlug}-${counter}`;
		counter++;
	}

	await prisma.organization.create({
		data: {
			name,
			uniqueId,
			owner_user_id: session.user.id,
			User_Organization: {
				create: {
					user_id: session.user.id,
					role: Role.OWNER,
				},
			},
		},
	});

	revalidatePath("/organizations");
	redirect(`/${uniqueId}`);
}; 