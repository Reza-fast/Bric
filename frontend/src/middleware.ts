import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const COOKIE = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? "bric_token";

const intlMiddleware = createMiddleware(routing);

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

function isProtected(path: string): boolean {
  return (
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/projects" ||
    path.startsWith("/projects/") ||
    path === "/planning" ||
    path.startsWith("/planning/") ||
    path === "/documents" ||
    path.startsWith("/documents/") ||
    path === "/profile" ||
    path.startsWith("/profile/") ||
    path === "/team" ||
    path.startsWith("/team/") ||
    path === "/time" ||
    path.startsWith("/time/") ||
    path === "/reporting" ||
    path.startsWith("/reporting/")
  );
}

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const path = stripLocale(pathname);
  const hasSession = Boolean(request.cookies.get(COOKIE)?.value);

  if (isProtected(path) && !hasSession) {
    const url = request.nextUrl.clone();
    const localePrefix =
      path !== pathname && pathname.startsWith("/fr")
        ? "/fr"
        : "";
    url.pathname = `${localePrefix}/login`;
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  if ((path === "/login" || path === "/register") && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = path !== pathname && pathname.startsWith("/fr") ? "/fr/dashboard" : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
