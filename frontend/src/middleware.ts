import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? "bric_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(COOKIE)?.value);

  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/")
  ) {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/login" || pathname === "/register") {
    if (hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/projects",
    "/projects/:path*",
    "/profile",
    "/profile/:path*",
    "/login",
    "/register",
  ],
};
