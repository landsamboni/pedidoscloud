import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
