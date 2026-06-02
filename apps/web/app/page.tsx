import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * Root route — smart redirect based on session state.
 *
 * Authenticated as restaurant → /restaurant/[slug]
 * Authenticated as admin      → /admin
 * Not authenticated           → /login
 *
 * Customer-facing pages (/r/[slug]) are shared directly by the restaurant
 * and are never reached through this root route.
 */
export default async function RootPage() {
  const session = await getSession();

  if (session?.role === "admin") {
    redirect("/admin");
  }

  if (session?.role === "restaurant" && session.restaurantSlug) {
    redirect(`/restaurant/${session.restaurantSlug}`);
  }

  redirect("/login");
}
