import type { Config } from "tailwindcss";
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: { sans: ["DM Sans", "Inter", "system-ui", "sans-serif"] },
      colors: {
        border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))",
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))", foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))", "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))", "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))", ring: "hsl(var(--sidebar-ring))",
        },
        accent: { DEFAULT: "hsl(var(--accent-primary))", hover: "hsl(var(--accent-primary-hover))", light: "hsl(var(--accent-primary-light))", foreground: "hsl(var(--accent-foreground))" },
        warm: { DEFAULT: "hsl(var(--accent-warm))" },
        // MetasIA named colors (use directly as e.g. bg-navy, text-blue, border-green)
        navy: { DEFAULT: "var(--color-navy)", 2: "var(--color-navy-2)", 3: "var(--color-navy-3)" },
        blue: { DEFAULT: "var(--color-blue)", hover: "var(--color-blue-hover)", soft: "var(--color-blue-soft)" },
        green: { DEFAULT: "var(--color-green)", bg: "var(--color-green-bg)" },
        amber: { DEFAULT: "var(--color-amber)", bg: "var(--color-amber-bg)" },
        red: { DEFAULT: "var(--color-red)", bg: "var(--color-red-bg)" },
      },
      boxShadow: {
        "elevation-1": "0 1px 2px rgba(26,26,46,0.04)", "elevation-2": "0 2px 8px rgba(26,26,46,0.05)",
        "elevation-3": "0 4px 16px rgba(26,26,46,0.07)", "elevation-4": "0 8px 32px rgba(26,26,46,0.09)",
        "elevation-5": "0 16px 48px rgba(26,26,46,0.12)", "accent-glow": "0 4px 16px rgba(9,42,73,0.35)",
        "accent-glow-lg": "0 8px 24px rgba(9,42,73,0.50)",
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)", "2xl": "1rem" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out" },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
