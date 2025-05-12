import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/", "/login"];

export async function middleware(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;

  console.log("🧩 MIDDLEWARE: Pathname =", pathname);
  console.log("🧩 MIDDLEWARE: Session =", session);
  console.log("🧩 MIDDLEWARE: Cookies =", request.cookies.getAll());

  const isPublic = publicRoutes.includes(pathname);
  const isLoggedIn = !!session?.user;

if (!isLoggedIn && !isPublic) {
  console.log("🛑 Redirecting to /login"); // isso deve aparecer
  return NextResponse.redirect(new URL("/login", request.url));
}


  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
