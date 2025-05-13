
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
	const session = await auth();

	if (!session?.user?.id) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const memberships = await prisma.user_Organization.findMany({
		where: { user_id: session.user.id },
		include: {
			organization: {
				select: {
					id: true,
					name: true,
					uniqueId: true,
				},
			},
		},
	});

	const organizations = memberships.map((m) => m.organization);

	return NextResponse.json(organizations);
}
