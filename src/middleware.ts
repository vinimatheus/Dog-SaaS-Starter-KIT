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
	"auth"
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

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	
	// Adiciona headers de segurança
	const response = NextResponse.next()
	
	// Headers de segurança
	response.headers.set('X-Frame-Options', 'DENY')
	response.headers.set('X-Content-Type-Options', 'nosniff')
	response.headers.set('X-XSS-Protection', '1; mode=block')
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
	
	// HSTS apenas em produção
	if (process.env.NODE_ENV === 'production') {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains'
		)
	}

	// Permite requisições OPTIONS para CORS
	if (request.method === 'OPTIONS') {
		return new NextResponse(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-csrf-token',
			},
		})
	}
	
	// Tratamento especial para rotas de autenticação
	if (pathname.startsWith('/api/auth')) {
		// Permite requisições de autenticação sem verificações adicionais
		return response
	}
	
	if (pathname.startsWith('/api/organizations')) {
		const referer = request.headers.get('referer') || '';
		const apiKey = request.headers.get('x-api-key') || '';
		
		const allowedOrigins = [
			process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
		];
		
		const isAllowedReferer = allowedOrigins.some(origin => 
			origin && referer.startsWith(origin)
		);
		
		const isValidApiKey = apiKey === process.env.ORG_API_SECRET;
		
		if (!isAllowedReferer && !isValidApiKey) {
			console.log('Acesso bloqueado via middleware:', pathname, { referer });
			return new NextResponse('Forbidden', { status: 403 });
		}
	}
	
	const routeMatch = matchOrganizationRoute(pathname);

	if (routeMatch.isOrgRoute && routeMatch.uniqueOrganizationId) {
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set("x-unique-org-id", routeMatch.uniqueOrganizationId);

		return NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});
	}
	
	return response
}