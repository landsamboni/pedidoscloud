import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        "3xl": "1920px", // large monitors / widescreen
        "4xl": "2560px", // 27-32" monitors
      },
    },
  },
  plugins: [],
} satisfies Config;
