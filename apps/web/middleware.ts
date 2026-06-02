import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/auth";

/**
 * JWT-based session middleware for operator areas of the app.
 *
 * Replaces the previous HTTP Basic Auth approach with proper per-restaurant
 * sessions. Sessions are stored in an HttpOnly cookie signed with AUTH_SECRET.
 *
 * Public routes (customer-facing) are NOT listed in the matcher and are
 * therefore never touched by this middleware.
 *
 * Auth flow:
 *   /admin/*       → requires role=admin
 *   /restaurant/[slug]/* → requires role=restaurant AND slug matches the path
 *   Unauthenticated or wrong role → redirect to /login?from=current_path
 */
export const config = {
  matcher: ["/admin/:path*", "/restaurant/:path*"],
};

function getSecret() {
  const s = process.env.AUTH_SECRET ?? "dev-fallback-secret-change-me-in-production-32chars";
  return new TextEncoder().encode(s);
}

async function getSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { role: string; restaurantSlug?: string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js router prefetch requests — they shouldn't trigger auth challenges
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";
  if (isPrefetch) return new NextResponse(null, { status: 401 });

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getSession(token);

  function redirectToLogin() {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (!session) return redirectToLogin();

  if (pathname.startsWith("/admin")) {
    if (session.role !== "admin") return redirectToLogin();
    return NextResponse.next();
  }

  if (pathname.startsWith("/restaurant")) {
    const slug = pathname.split("/")[2]; // /restaurant/[slug]/...
    if (session.role !== "restaurant" || session.restaurantSlug !== slug) {
      return redirectToLogin();
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}
