import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-merriweather)", "Merriweather", "Georgia", "serif"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-14px) rotate(2deg)" },
        },
        "float-alt": {
          "0%, 100%": { transform: "translateY(-8px) rotate(-1deg)" },
          "50%": { transform: "translateY(8px) rotate(1deg)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) rotate(-1deg)" },
          "50%": { transform: "translateY(-18px) rotate(1deg)" },
        },
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 8px 20px rgba(253, 99, 51, 0.35)",
          },
          "50%": {
            boxShadow:
              "0 8px 32px rgba(253, 99, 51, 0.6), 0 0 48px rgba(253, 99, 51, 0.2)",
          },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0px)" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        "float-alt": "float-alt 5.5s ease-in-out infinite",
        "float-slow": "float-slow 6.5s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
