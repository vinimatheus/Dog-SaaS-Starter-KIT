import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
	],
};

// Rotas públicas que não precisam de autenticação
const PUBLIC_ROUTES = new Set([
	"/login",
	"/auth/signin",
	"/auth/signout",
	"/invite",
	"/invite/switch-account",
]);

// Rotas protegidas que precisam de autenticação
const PROTECTED_ROUTES = new Set([
	"/organizations",
	"/settings",
]);

export async function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname;

	// Se for uma rota pública, permite o acesso
	if (PUBLIC_ROUTES.has(pathname)) {
		return NextResponse.next();
	}

	// Se for uma rota de API, permite o acesso
	if (pathname.startsWith("/api")) {
		return NextResponse.next();
	}

	const session = await auth();

	// Se não estiver autenticado e tentar acessar rota protegida
	if (!session?.user && PROTECTED_ROUTES.has(pathname)) {
		const url = new URL("/login", request.url);
		url.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(url);
	}

	// Se estiver autenticado e tentar acessar rota de login
	if (session?.user && pathname === "/login") {
		return NextResponse.redirect(new URL("/organizations", request.url));
	}

	// Para rotas de organização, verifica se o usuário tem acesso
	if (pathname !== "/" && !pathname.startsWith("/_next") && !PUBLIC_ROUTES.has(pathname)) {
		const segments = pathname.split("/").filter(Boolean);
		const firstSegment = segments[0];

		if (firstSegment && !PROTECTED_ROUTES.has(`/${firstSegment}`)) {
			const requestHeaders = new Headers(request.headers);
			requestHeaders.set("x-unique-org-id", firstSegment);
			
			return NextResponse.next({
				request: {
					headers: requestHeaders,
				},
			});
		}
	}

	return NextResponse.next();
}