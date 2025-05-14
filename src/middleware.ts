import { type NextRequest, NextResponse } from "next/server";

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
	],
};

interface RouteMatch {
	isOrgRoute: boolean;
	uniqueOrganizationId?: string;
}

export const RESERVED_PATHS = new Set([
	"api",
	"_next",
	"favicon.ico",
	"sitemap.xml",
	"robots.txt",
	"organizations",
	"auth",
]);

function matchOrganizationRoute(pathname: string): RouteMatch {
	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname === "/" ||
		pathname === ""
	) {
		return { isOrgRoute: false };
	}

	const segments = pathname.split("/").filter(Boolean);
	const firstSegment = segments[0];

	if (!firstSegment) return { isOrgRoute: false };

	if (RESERVED_PATHS.has(firstSegment.toLowerCase())) {
		return { isOrgRoute: false };
	}

	return {
		isOrgRoute: true,
		uniqueOrganizationId: firstSegment,
	};
}

export function middleware(request: NextRequest) {
	// Obter a URL solicitada
	const url = request.nextUrl.clone();
	const { pathname } = url;

	// Proteger a API de organizações
	if (pathname.startsWith('/api/organizations')) {
		// Obter o referer
		const referer = request.headers.get('referer') || '';
		const apiKey = request.headers.get('x-api-key') || '';
		
		// Definir origens permitidas
		const allowedOrigins = [
			process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
		];
		
		// Verificar se o referer é de uma origem permitida ou se há uma API key válida
		const isAllowedReferer = allowedOrigins.some(origin => 
			origin && referer.startsWith(origin)
		);
		
		const isValidApiKey = apiKey === process.env.ORG_API_SECRET;
		
		// Se não for um referer permitido nem uma chave de API válida, bloquear
		if (!isAllowedReferer && !isValidApiKey) {
			console.log('Acesso bloqueado via middleware:', pathname, { referer });
			return new NextResponse('Forbidden', { status: 403 });
		}
	}
	
	// Verificar e processar rotas de organização
	const routeMatch = matchOrganizationRoute(pathname);

	// Se for uma rota de organização, adicionar o ID da organização aos cabeçalhos
	if (routeMatch.isOrgRoute && routeMatch.uniqueOrganizationId) {
	const requestHeaders = new Headers(request.headers);
		requestHeaders.set("x-unique-org-id", routeMatch.uniqueOrganizationId);

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});
	}
	
	// Permitir a solicitação para continuar
	return NextResponse.next();
}