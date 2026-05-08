import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Simple auth gate for page routes.
 *
 * Notes:
 * - We keep Route Handlers (/api/*) accessible so they can return proper 401 JSON.
 * - We protect UI routes by redirecting to /login when there is no session cookie.
 */
export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/daniel/torneos") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  const session = req.cookies.get("session")?.value;
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/:path*",
};
