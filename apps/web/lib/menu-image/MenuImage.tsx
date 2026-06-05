import { MENU_IMAGE as M } from "./template-spec";

export type MenuImageGroup = {
  label: string;
  items: { name: string; surcharge: string }[]; // surcharge "" when none, else "+$3.000"
};

export type MenuImageProps = {
  restaurantName: string;
  basePriceLabel: string; // e.g. "$14.000"
  subtitle: string; // e.g. "MENÚ DEL DÍA" or "NUESTROS PRODUCTOS"
  groups: MenuImageGroup[];
  backgroundDataUri: string | null;
  logoDataUri: string | null; // shown top-left
  phone: string | null; // shown in the footer WhatsApp banner
};

const WA_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

/**
 * The text layer rendered (by Satori, via next/og ImageResponse) over a
 * restaurant's 1080×1350 background template. The menu sits in a centered panel
 * sized to its content (so the background shows around it); a WhatsApp footer
 * banner with the phone is pinned at the bottom. Font size scales with the
 * number of options so long menus still fit.
 */
export function MenuImage({ restaurantName, basePriceLabel, subtitle, groups, backgroundDataUri, logoDataUri, phone }: MenuImageProps) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const itemFont = total <= 10 ? 34 : total <= 14 ? 29 : total <= 18 ? 25 : 22;
  const labelFont = Math.round(itemFont * 0.8);
  const gapItems = Math.round(itemFont * 0.3);
  const gapGroups = Math.round(itemFont * 0.95);

  return (
    <div style={{ position: "relative", display: "flex", width: M.width, height: M.height }}>
      {backgroundDataUri ? (
        <img
          src={backgroundDataUri}
          width={M.width}
          height={M.height}
          style={{ position: "absolute", top: 0, left: 0, width: M.width, height: M.height, objectFit: "cover" }}
        />
      ) : (
        <div style={{ position: "absolute", top: 0, left: 0, width: M.width, height: M.height, backgroundImage: M.fallbackBackground }} />
      )}

      {/* Logo — top-left, image only (no container) */}
      {logoDataUri && (
        <img
          src={logoDataUri}
          width={220}
          height={220}
          style={{ position: "absolute", top: 36, left: 36, width: 220, height: 220, objectFit: "contain" }}
        />
      )}

      {/* Centered menu panel (sized to content) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: M.width,
          height: M.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${M.padY}px ${M.padX}px ${M.padY + 84}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: M.width - M.padX * 2,
            borderRadius: 32,
            padding: "44px 48px",
            backgroundColor: `rgba(${M.backdrop}, ${M.backdropOpacity})`,
          }}
        >
          <div style={{ display: "flex", textAlign: "center", fontSize: 56, color: M.accent }}>{restaurantName}</div>
          <div style={{ display: "flex", fontSize: 24, color: M.muted, letterSpacing: 5, marginTop: 8 }}>{subtitle}</div>
          {basePriceLabel ? (
            <div style={{ display: "flex", fontSize: 30, color: M.ink, marginTop: 16 }}>Almuerzo {basePriceLabel}</div>
          ) : null}

          {groups.map((g) => (
            <div key={g.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: gapGroups }}>
              <div style={{ display: "flex", fontSize: labelFont, color: M.accent, letterSpacing: 3 }}>{g.label.toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10, gap: gapItems }}>
                {g.items.map((it, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, fontSize: itemFont, color: M.ink }}>
                    <span>{it.name}</span>
                    {it.surcharge && <span style={{ fontSize: Math.round(itemFont * 0.72), color: M.surcharge }}>{it.surcharge}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp footer banner */}
      {phone && (
        <div style={{ position: "absolute", bottom: 32, left: 0, width: M.width, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              backgroundColor: "#25D366",
              color: "#ffffff",
              borderRadius: 20,
              padding: "10px 22px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#ffffff">
              <path d={WA_PATH} />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, letterSpacing: 3, opacity: 0.95 }}>PEDIDOS</span>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{phone}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
