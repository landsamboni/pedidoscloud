import { NextResponse, type NextRequest } from "next/server";

/**
 * Minimal HTTP Basic Auth gate for the operator areas of the app.
 *
 * This is an MVP-grade stopgap, NOT a real auth system. Credentials come from
 * environment variables so they can be set per-environment in Amplify:
 *   - /admin            -> ADMIN_USER / ADMIN_PASSWORD
 *   - /restaurant/...   -> RESTAURANT_USER / RESTAURANT_PASSWORD (shared)
 *
 * If the password for an area is not set, that area is left OPEN — this keeps
 * local development frictionless. Always set the passwords in staging/prod.
 *
 * Public customer routes (/r/..., /api/files, /) are never gated here.
 *
 * Next step beyond the MVP: replace with per-restaurant accounts via NextAuth
 * or Amazon Cognito.
 */
export const config = {
  matcher: ["/admin/:path*", "/restaurant/:path*"],
};

const REALM = 'Basic realm="PedidosCloud", charset="UTF-8"';

function unauthorized() {
  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

function isAuthorized(header: string | null, expectedUser: string | undefined, expectedPassword: string | undefined) {
  // No password configured for this area -> open (local dev convenience).
  if (!expectedPassword) return true;
  if (!header?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return user === (expectedUser || "admin") && password === expectedPassword;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const header = request.headers.get("authorization");

  if (pathname.startsWith("/admin")) {
    if (!isAuthorized(header, process.env.ADMIN_USER, process.env.ADMIN_PASSWORD)) return unauthorized();
  } else if (pathname.startsWith("/restaurant")) {
    if (!isAuthorized(header, process.env.RESTAURANT_USER, process.env.RESTAURANT_PASSWORD)) return unauthorized();
  }

  return NextResponse.next();
}
