import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary — brand blue
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // Accent — violet for AI/smart features
        accent: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        // Emerald — success states
        success: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        // Amber — warning states
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // Rose — error states
        danger: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
        // Surfaces for dark mode
        surface: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          700: "#27272a",
          800: "#1c1c1e",
          850: "#161618",
          900: "#111113",
          950: "#09090b",
        },
      },

      // Custom shadow scale
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
        soft: "0 2px 8px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
        md: "0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)",
        lg: "0 8px 24px -4px rgb(0 0 0 / 0.1), 0 4px 8px -4px rgb(0 0 0 / 0.06)",
        xl: "0 16px 48px -8px rgb(0 0 0 / 0.12), 0 8px 16px -8px rgb(0 0 0 / 0.08)",
        glow: "0 0 20px -4px rgb(59 130 246 / 0.35)",
        "glow-accent": "0 0 20px -4px rgb(139 92 246 / 0.35)",
        "glow-success": "0 0 20px -4px rgb(16 185 129 / 0.35)",
        "glow-warning": "0 0 20px -4px rgb(245 158 11 / 0.35)",
        "glow-danger": "0 0 20px -4px rgb(244 63 94 / 0.35)",
        // Dark mode shadows
        "dark-sm": "0 2px 8px 0 rgb(0 0 0 / 0.3)",
        "dark-md": "0 4px 16px 0 rgb(0 0 0 / 0.4)",
        "dark-lg": "0 8px 32px 0 rgb(0 0 0 / 0.5)",
      },

      // Animation keyframes
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-down": {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px 0 rgb(59 130 246 / 0.2)" },
          "50%": { boxShadow: "0 0 20px 4px rgb(59 130 246 / 0.4)" },
        },
        "slide-up-fade": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-8px)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(100%)" },
        },
        "drawer-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "backdrop-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "indicator-slide": {
          "0%": { transform: "var(--indicator-from, translateX(0))" },
          "100%": { transform: "var(--indicator-to, translateX(0))" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "bounce-in": {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        "check-in": {
          "0%": { opacity: "0", transform: "scale(0) rotate(-45deg)" },
          "50%": { opacity: "1", transform: "scale(1.2) rotate(0deg)" },
          "100%": { transform: "scale(1) rotate(0deg)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "slide-out-right": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(100%)" },
        },
        "bounce-subtle": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
      },

      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
        "fade-down": "fade-down 0.4s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        shimmer: "shimmer 2s infinite linear",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-up-fade": "slide-up-fade 0.2s ease-in forwards",
        "toast-in": "toast-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1)",
        "toast-out": "toast-out 0.25s ease-in forwards",
        "drawer-in": "drawer-in 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        "backdrop-in": "backdrop-in 0.2s ease-out",
        "indicator-slide": "indicator-slide 0.25s ease-out",
        shake: "shake 0.5s ease-in-out",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "check-in": "check-in 0.4s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "slide-out-right": "slide-out-right 0.3s ease-in forwards",
        "bounce-subtle": "bounce-subtle 0.3s ease-out",
      },

      // Typography
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.02em",
      },
      lineHeight: {
        relaxed: "1.75",
      },

      // Backdrop blur for glassmorphism
      backdropBlur: {
        xs: "2px",
      },

      // Border radius
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      // Transition timing
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [
    // Utility for glass-morphism
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".glass": {
          "backdrop-filter": "blur(12px) saturate(180%)",
          "background-color": "rgba(255, 255, 255, 0.72)",
        },
        ".glass-dark": {
          "backdrop-filter": "blur(12px) saturate(180%)",
          "background-color": "rgba(17, 17, 19, 0.72)",
        },
        ".gradient-primary": {
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #7c3aed 100%)",
        },
        ".gradient-hero": {
          background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #ecfdf5 100%)",
        },
        ".gradient-hero-dark": {
          background: "linear-gradient(135deg, #172554 0%, #2e1065 50%, #064e3b 100%)",
        },
        ".text-gradient": {
          "background-image": "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)",
          "-webkit-background-clip": "text",
          "-webkit-text-fill-color": "transparent",
          "background-clip": "text",
        },
      });
    }),
  ],
};

export default config;
