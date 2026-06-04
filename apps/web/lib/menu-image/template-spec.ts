/**
 * Shared spec for the shareable menu image. Every restaurant template is a
 * 1080×1350 background; the menu TEXT is rendered centered on top in the same
 * position for all of them (see MenuImage.tsx). Tweak the constants here to
 * adjust the look globally.
 */
export const MENU_IMAGE = {
  width: 1080,
  height: 1350,

  // Centered text area: padding from the canvas edges.
  padX: 96,
  padY: 80,

  // Soft panel behind the text so it stays legible over any background.
  // Set backdropOpacity to 0 to render text directly on the template.
  backdrop: "255, 251, 245", // warm white (RGB)
  backdropOpacity: 0.9,

  // Colors
  ink: "#1c1917", // stone-900
  muted: "#78716c", // stone-500
  accent: "#2575FC", // brand blue
  surcharge: "#b45309", // amber-700

  // Fallback background (when a restaurant has not uploaded a template yet):
  // a soft brand gradient (blue → purple → pink) drawn in CSS — no image needed.
  fallbackBackground: "linear-gradient(135deg, #eef4ff 0%, #efeaff 50%, #fde6f4 100%)",
} as const;

export const CATEGORY_LABELS = {
  soups: "Sopas",
  proteins: "Proteínas",
  sides: "Principios",
  drinks: "Bebidas",
} as const;
