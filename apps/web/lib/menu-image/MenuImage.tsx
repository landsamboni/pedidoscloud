import { MENU_IMAGE as M } from "./template-spec";

export type MenuImageGroup = {
  label: string;
  items: { name: string; surcharge: string }[]; // surcharge "" when none, else "+$3.000"
};

export type MenuImageProps = {
  restaurantName: string;
  basePriceLabel: string; // e.g. "$14.000"
  groups: MenuImageGroup[];
  backgroundDataUri: string | null;
};

/**
 * The text layer rendered (by Satori, via next/og ImageResponse) over a
 * restaurant's 1080×1350 background template. Everything is centered and the
 * font size scales down with the number of options so long menus still fit.
 * This returns a plain element tree — not a client/runtime React component.
 */
export function MenuImage({ restaurantName, basePriceLabel, groups, backgroundDataUri }: MenuImageProps) {
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
          padding: `${M.padY}px ${M.padX}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            borderRadius: 36,
            padding: "52px 44px",
            backgroundColor: `rgba(${M.backdrop}, ${M.backdropOpacity})`,
          }}
        >
          <div style={{ display: "flex", textAlign: "center", fontSize: 56, color: M.accent }}>{restaurantName}</div>
          <div style={{ display: "flex", fontSize: 24, color: M.muted, letterSpacing: 5, marginTop: 8 }}>MENÚ DEL DÍA</div>
          <div style={{ display: "flex", fontSize: 30, color: M.ink, marginTop: 16 }}>Almuerzo {basePriceLabel}</div>

          {groups.map((g) => (
            <div key={g.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: gapGroups }}>
              <div style={{ display: "flex", fontSize: labelFont, color: M.accent, letterSpacing: 3 }}>{g.label.toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: 10, gap: gapItems }}>
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
    </div>
  );
}
