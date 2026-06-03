import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "hsl(220, 90%, 96%)",
          100: "hsl(220, 85%, 92%)",
          200: "hsl(220, 80%, 84%)",
          300: "hsl(220, 75%, 72%)",
          400: "hsl(220, 70%, 60%)",
          500: "hsl(220, 65%, 50%)",
          600: "hsl(220, 70%, 42%)",
          700: "hsl(220, 75%, 34%)",
          800: "hsl(220, 80%, 26%)",
          900: "hsl(220, 85%, 18%)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          border: "var(--surface-border)",
        },
        status: {
          pending: "hsl(45, 90%, 55%)",
          generated: "hsl(200, 80%, 55%)",
          sent: "hsl(145, 65%, 48%)",
          replied: "hsl(280, 60%, 55%)",
          bounced: "hsl(0, 75%, 55%)",
        },
      },
      borderRadius: {
        "xl": "0.875rem",
        "2xl": "1rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
