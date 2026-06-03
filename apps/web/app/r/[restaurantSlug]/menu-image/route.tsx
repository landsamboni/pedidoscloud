import { ImageResponse } from "next/og";
import { getRestaurantMenu } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { formatSurcharge, parseItemName, parseSurcharge } from "@/lib/menu";
import { MenuImage } from "@/lib/menu-image/MenuImage";
import { CATEGORY_LABELS, MENU_IMAGE } from "@/lib/menu-image/template-spec";

// Needs prisma + S3, so Node runtime (not Edge), and always fresh.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mimeFromPath(p: string): string {
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/** Read the restaurant's uploaded template (S3 or local) as a data URI, or null. */
async function backgroundDataUri(pathValue: string | null | undefined): Promise<string | null> {
  if (!pathValue) return null;
  try {
    if (pathValue.startsWith("/uploads/")) {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const buf = await fs.readFile(path.join(process.cwd(), "public", pathValue));
      return `data:${mimeFromPath(pathValue)};base64,${buf.toString("base64")}`;
    }
    const { getObject } = await import("@/lib/storage");
    const { bytes, contentType } = await getObject(pathValue);
    const mime = contentType.startsWith("image/") ? contentType : mimeFromPath(pathValue);
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null; // fall back to the CSS background if the template can't be read
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getRestaurantMenu(restaurantSlug);
  const menu = restaurant?.menus[0];
  if (!restaurant || !menu) {
    return new Response("No hay menú publicado para hoy.", { status: 404 });
  }

  const categories: [keyof typeof CATEGORY_LABELS, string[]][] = [
    ["soups", menu.soups],
    ["proteins", menu.proteins],
    ["sides", menu.sides],
    ["drinks", menu.drinks],
  ];
  const groups = categories.map(([key, options]) => ({
    label: CATEGORY_LABELS[key],
    items: options.map((raw) => {
      const surcharge = parseSurcharge(raw);
      return { name: parseItemName(raw), surcharge: surcharge > 0 ? formatSurcharge(surcharge) : "" };
    }),
  }));

  const [background, logo] = await Promise.all([
    backgroundDataUri(restaurant.menuTemplatePath),
    backgroundDataUri(restaurant.logoPath),
  ]);
  const phone = restaurant.whatsappPhone ?? restaurant.nequiPhone ?? null;

  return new ImageResponse(
    (
      <MenuImage
        restaurantName={restaurant.name}
        basePriceLabel={formatMoney(Number(restaurant.basePrice))}
        groups={groups}
        backgroundDataUri={background}
        logoDataUri={logo}
        phone={phone}
      />
    ),
    {
      width: MENU_IMAGE.width,
      height: MENU_IMAGE.height,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
