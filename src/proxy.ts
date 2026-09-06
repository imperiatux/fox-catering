import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/redis";

const COOKIE_NAME = "NEXT_LOCALE";
const DEFAULT_LOCALE = "ro";
const SUPPORTED_LOCALES = ["ro", "en"];

const SESSION_COOKIE = "admin_session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ------------------------------------------------------------------
  // Admin auth guard
  // /api/admin/login is always allowed through (it IS the login endpoint)
  // All other /admin/* and /api/admin/* paths require a valid session
  // ------------------------------------------------------------------
  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isLoginEndpoint =
    pathname === "/api/admin/login" || pathname === "/admin/login";

  if (isAdminPath && !isLoginEndpoint) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    let authenticated = false;

    if (token) {
      const value = await getSession(token);
      authenticated = value === "admin";
    }

    if (!authenticated) {
      // API routes return 401; page routes redirect to the login page
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ------------------------------------------------------------------
  // Locale cookie logic
  // ------------------------------------------------------------------
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    return NextResponse.next();
  }

  // No cookie set yet — default to Romanian regardless of browser language
  const locale = DEFAULT_LOCALE;
  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, locale, { path: "/", sameSite: "lax" });
  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
