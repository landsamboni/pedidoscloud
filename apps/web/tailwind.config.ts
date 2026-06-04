import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette (see globals.css for usage):
        //   blue   = primary actions      purple = secondary       pink = cancel
        brand: {
          blue: "#2575FC",
          purple: "#7B61FF",
          pink: "#E94DBD",
        },
        // The app historically used `teal` as its primary/brand color across all
        // screens. We remap the whole teal scale to the brand blue so every
        // existing `teal-*` class becomes blue at once — WITHOUT touching the
        // semantic status colors used in the orders board (sky/amber/purple/
        // emerald/red) or the analytics heatmap, which don't use teal.
        teal: {
          50: "#eff4ff",
          100: "#dbe7ff",
          200: "#bcd3ff",
          300: "#8eb4ff",
          400: "#5a90fb",
          500: "#3680fc",
          600: "#2575FC", // primary button / brand
          700: "#1b5fd9", // hover (darker)
          800: "#1c4ea8",
          900: "#1d4585",
        },
      },
      fontFamily: {
        // Inter (loaded via next/font in app/layout.tsx), with a system fallback
        // so text renders even before the webfont swaps in.
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      screens: {
        "3xl": "1920px", // large monitors / widescreen
        "4xl": "2560px", // 27-32" monitors
      },
    },
  },
  plugins: [],
} satisfies Config;
