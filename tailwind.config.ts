import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          50: "var(--color-primary-50)", 100: "var(--color-primary-100)", 200: "var(--color-primary-200)",
          300: "var(--color-primary-300)", 400: "var(--color-primary-400)", 500: "var(--color-primary-500)",
          600: "var(--color-primary-600)", 700: "var(--color-primary-700)", 800: "var(--color-primary-800)",
          900: "var(--color-primary-900)", DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          50: "var(--color-secondary-50)", 100: "var(--color-secondary-100)", 200: "var(--color-secondary-200)",
          300: "var(--color-secondary-300)", 400: "var(--color-secondary-400)", 500: "var(--color-secondary-500)",
          600: "var(--color-secondary-600)", 700: "var(--color-secondary-700)", 800: "var(--color-secondary-800)",
          900: "var(--color-secondary-900)", DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: { light: "var(--color-success-light)", DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))", dark: "var(--color-success-dark)" },
        warning: { light: "var(--color-warning-light)", DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))", dark: "var(--color-warning-dark)" },
        danger: { light: "var(--color-danger-light)", DEFAULT: "var(--color-danger)", dark: "var(--color-danger-dark)" },
        info: { light: "var(--color-info-light)", DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))", dark: "var(--color-info-dark)" },
        neutral: {
          0: "var(--color-neutral-0)", 50: "var(--color-neutral-50)", 100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)", 300: "var(--color-neutral-300)", 400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)", 600: "var(--color-neutral-600)", 700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)", 900: "var(--color-neutral-900)",
        },
        surface: { page: "var(--page-bg)", card: "var(--card-bg)", border: "var(--card-border)" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", xl: "var(--radius-xl)", full: "var(--radius-full)",
      },
      fontFamily: { sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"] },
      boxShadow: { card: "var(--card-shadow)", "card-hover": "var(--card-shadow-hover)" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
