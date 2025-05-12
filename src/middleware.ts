import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Configuração de segurança
const SECURITY_HEADERS = {
	"Content-Security-Policy": 
		"default-src 'self'; " +
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; " +
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
		"img-src 'self' data: https:; " +
		"font-src 'self' https://fonts.gstatic.com; " +
		"connect-src 'self' https://accounts.google.com; " +
		"frame-src 'self' https://accounts.google.com;",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"X-XSS-Protection": "1; mode=block",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

// Rotas que não precisam de CSRF
const PUBLIC_ROUTES = new Set([
	"/api/auth",
	"/login",
	"/auth/signin",
	"/auth/signout",
]);

// Rotas que precisam de autenticação
const PROTECTED_ROUTES = new Set([
	"/organizations",
	"/settings",
]);

// Rate limiting
const RATE_LIMIT = {
	windowMs: 15 * 60 * 1000, // 15 minutos
	max: 100, // limite de 100 requisições por janela
};

const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const requestData = ipRequestCounts.get(ip);

	if (!requestData || now > requestData.resetTime) {
		ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
		return false;
	}

	if (requestData.count >= RATE_LIMIT.max) {
		return true;
	}

	requestData.count++;
	return false;
}

function validateCSRFToken(request: NextRequest): boolean {
	// Skip CSRF check for public routes
	if (PUBLIC_ROUTES.has(request.nextUrl.pathname)) {
		return true;
	}

	// Skip CSRF check for GET requests
	if (request.method === "GET") {
		return true;
	}

	const csrfToken = request.headers.get("x-csrf-token");
	const sessionToken = request.cookies.get("next-auth.csrf-token")?.value;

	if (!csrfToken || !sessionToken) {
		return false;
	}

	// Verifica se o token CSRF corresponde ao token da sessão
	return csrfToken === sessionToken;
}

function validateEmail(email: string): boolean {
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	return emailRegex.test(email);
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|public).*)",
	],
};

export async function middleware(request: NextRequest) {
	const response = NextResponse.next();

	// Adiciona headers de segurança
	Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
		response.headers.set(key, value);
	});

	// Rate limiting para APIs
	if (request.nextUrl.pathname.startsWith("/api")) {
		const forwardedFor = request.headers.get("x-forwarded-for");
		const ip = forwardedFor ? forwardedFor.split(",")[0] : "unknown";
		
		if (isRateLimited(ip)) {
			return new NextResponse("Too Many Requests", { status: 429 });
		}
	}

	// Validação CSRF
	if (!validateCSRFToken(request)) {
		return new NextResponse("Invalid CSRF token", { status: 403 });
	}

	// Validação de email para rotas específicas
	if (request.nextUrl.pathname.startsWith("/invite/switch-account")) {
		const email = request.nextUrl.searchParams.get("email");
		if (email && !validateEmail(email)) {
			return new NextResponse("Invalid email format", { status: 400 });
		}
	}

	// Verificação de autenticação
	const token = await getToken({ 
		req: request,
		secret: process.env.AUTH_SECRET 
	});

	// Se não estiver autenticado e tentar acessar rota protegida
	if (!token && PROTECTED_ROUTES.has(request.nextUrl.pathname)) {
		const url = new URL("/login", request.url);
		url.searchParams.set("callbackUrl", request.nextUrl.pathname);
		return NextResponse.redirect(url);
	}

	// Se estiver autenticado e tentar acessar rota de login
	if (token && request.nextUrl.pathname === "/login") {
		return NextResponse.redirect(new URL("/organizations", request.url));
	}

	return response;
}