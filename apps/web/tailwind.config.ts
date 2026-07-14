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
        background: "#0B2540",
        foreground: "#ffffff",
        brand: {
          navy: "#0B2540",
          teal: "#0F9E8F",
          gold: "#D9A441",
        }
      },
      boxShadow: {
        'neu-up': '7px 7px 14px #081a2d, -7px -7px 14px #0e3053',
        'neu-down': 'inset 7px 7px 14px #081a2d, inset -7px -7px 14px #0e3053',
        'neu-up-sm': '4px 4px 8px #081a2d, -4px -4px 8px #0e3053',
        'neu-down-sm': 'inset 4px 4px 8px #081a2d, inset -4px -4px 8px #0e3053',
      },
    },
  },
  plugins: [],
};
export default config;
