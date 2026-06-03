import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/auth";

export const config = {
  matcher: ["/admin/:path*", "/restaurant/:path*"],
};

function getSecret() {
  // Use || (not ??) so an empty string also falls back — must match lib/auth.ts,
  // which signs the token. AUTH_SECRET is inlined at build time (see next.config.ts)
  // so this resolves to the real secret in the deployed middleware bundle.
  const s = process.env.AUTH_SECRET || "dev-fallback-secret-change-me-in-production-32chars";
  return new TextEncoder().encode(s);
}

async function getSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { role: string; restaurantSlug?: string; subscriptionEndsAt?: string };
  } catch {
    return null;
  }
}

/** Immediate suspension — no grace period. */
function isSubscriptionSuspended(subscriptionEndsAt: string | undefined): boolean {
  if (!subscriptionEndsAt) return false; // no subscription set = allow (pending setup)
  return new Date() > new Date(subscriptionEndsAt);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    const slug = pathname.split("/")[2];
    if (session.role !== "restaurant" || session.restaurantSlug !== slug) {
      return redirectToLogin();
    }

    // Immediate suspension check — if endsAt is in the past, block.
    if (isSubscriptionSuspended(session.subscriptionEndsAt)) {
      if (!pathname.includes("/suspended")) {
        return NextResponse.redirect(new URL(`/restaurant/${slug}/suspended`, request.url));
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}
