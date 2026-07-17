import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0B2540",
          teal: "#0F9E8F",
          gold: "#D9A441",
        },
        neu: {
          surface: "#F0F2F5",
          "surface-low": "#E4E8ED",
          "surface-mid": "#DDE2E8",
          "surface-high": "#D4DAE2",
          primary: "#0F9E8F",
          "primary-dark": "#0B7A6E",
          secondary: "#D9A441",
          "secondary-dark": "#B8872E",
          "on-surface": "#0B2540",
          "on-surface-variant": "#4A5D73",
          "on-primary": "#FFFFFF",
          outline: "#C5CDD6",
          "outline-variant": "#E0E5EB",
          error: "#C0392B",
          "error-light": "#FDECEA",
          success: "#0F9E8F",
        },
      },
      boxShadow: {
        "neu-raised":
          "8px 8px 16px #C8D0DA, -8px -8px 16px #FFFFFF",
        "neu-raised-sm":
          "4px 4px 8px #C8D0DA, -4px -4px 8px #FFFFFF",
        "neu-raised-xs":
          "2px 2px 4px #C8D0DA, -2px -2px 4px #FFFFFF",
        "neu-inset":
          "inset 5px 5px 10px #C8D0DA, inset -5px -5px 10px #FFFFFF",
        "neu-inset-sm":
          "inset 3px 3px 6px #C8D0DA, inset -3px -3px 6px #FFFFFF",
        "neu-inset-focus":
          "inset 5px 5px 10px #C8D0DA, inset -5px -5px 10px #FFFFFF, 0 0 0 2px #0F9E8F",
        "neu-topbar": "0 4px 12px rgba(11, 37, 64, 0.06)",
        "neu-teal-glow": "0 0 20px rgba(15, 158, 143, 0.35)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
