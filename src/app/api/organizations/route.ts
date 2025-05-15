import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
	try {
		
	const session = await auth();
	if (!session?.user?.id) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

		
		const headersList = await headers();
		
		
		const referer = headersList.get("referer") || "";
		const apiKey = headersList.get("x-api-key") || "";
		
		
		const allowedOrigins = [
			process.env.NEXT_PUBLIC_APP_URL || "http:localhost:3000"
		];
		
		const isAllowedReferer = allowedOrigins.some(origin => 
			origin && referer.startsWith(origin)
		);
		
		const isValidApiKey = apiKey === process.env.ORG_API_SECRET;
		
		
		if (!isAllowedReferer && !isValidApiKey) {
			console.log("Acesso bloqueado à API de organizações", { referer });
			return new NextResponse("Forbidden", { status: 403 });
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
	} catch (error) {
		console.error("Erro ao buscar organizações:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
