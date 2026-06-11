import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Deep background tones
        deep: {
          DEFAULT: "#0c0a1a",
          surface: "#110e24",
          elevated: "#1a1535",
        },
        // Glass tokens
        glass: {
          bg: "rgba(255, 255, 255, 0.05)",
          "bg-hover": "rgba(255, 255, 255, 0.08)",
          "bg-active": "rgba(255, 255, 255, 0.12)",
          "bg-elevated": "rgba(255, 255, 255, 0.07)",
          "bg-sidebar": "rgba(255, 255, 255, 0.04)",
          border: "rgba(255, 255, 255, 0.08)",
          "border-light": "rgba(255, 255, 255, 0.12)",
          highlight: "rgba(255, 255, 255, 0.06)",
        },
        // Primary accent — Synaps blue
        accent: {
          DEFAULT: "#6c8aff",
          light: "#8da4ff",
          dark: "#4c6ef5",
          glow: "rgba(108, 138, 255, 0.2)",
          muted: "rgba(108, 138, 255, 0.12)",
        },
        // Semantic text
        txt: {
          primary: "rgba(255, 255, 255, 0.92)",
          secondary: "rgba(255, 255, 255, 0.55)",
          tertiary: "rgba(255, 255, 255, 0.35)",
          muted: "rgba(255, 255, 255, 0.20)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }], // 10px
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "40px",
        "3xl": "64px",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "slide-in-left": "slideInLeft 0.3s ease-out",
        "scale-in": "scaleIn 0.25s ease-out",
        shimmer: "shimmer 2s infinite",
        "glass-glow": "glassGlow 3s ease-in-out infinite alternate",
        float: "float 6s ease-in-out infinite",
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
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glassGlow: {
          "0%": { boxShadow: "0 0 20px rgba(108, 138, 255, 0.05)" },
          "100%": { boxShadow: "0 0 40px rgba(108, 138, 255, 0.1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
