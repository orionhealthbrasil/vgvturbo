import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        defect: {
          delay: "hsl(var(--defect-delay))",
          "no-response": "hsl(var(--defect-no-response))",
          rude: "hsl(var(--defect-rude))",
          incorrect: "hsl(var(--defect-incorrect))",
          other: "hsl(var(--defect-other))",
        },
        chat: {
          outbound: "hsl(var(--chat-outbound))",
          "outbound-hover": "hsl(var(--chat-outbound-hover))",
          inbound: "hsl(var(--chat-inbound))",
          bg: "hsl(var(--chat-bg))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "float-up": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "10%": { opacity: "0.7" },
          "90%": { opacity: "0.7" },
          "100%": { transform: "translateY(calc(-1 * var(--float-distance, 800px)))", opacity: "0" },
        },
        "notification-in": {
          "0%, 100%": { opacity: "0", transform: "translateY(20px) scale(0.95)" },
          "10%, 75%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "85%": { opacity: "0", transform: "translateY(-10px) scale(0.95)" },
        },
        "breathe": {
          "0%, 100%": { transform: "translateX(-50%) scale(1)", opacity: "0.55" },
          "50%": { transform: "translateX(-50%) scale(1.06)", opacity: "0.75" },
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "bounce-dot": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "50%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "gradient-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "twinkle": {
          "0%, 100%": { opacity: "0.15", transform: "scale(0.7)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "star-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "shooting": {
          "0%": { transform: "rotate(135deg) translateX(0)", opacity: "0" },
          "3%": { opacity: "1" },
          "18%": { transform: "rotate(135deg) translateX(760px)", opacity: "0" },
          "100%": { transform: "rotate(135deg) translateX(760px)", opacity: "0" },
        },
        "orbit": { to: { transform: "rotate(360deg)" } },
        "orbit-rev": { to: { transform: "rotate(-360deg)" } },
        "aurora": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(6%, -8%) scale(1.12)" },
          "66%": { transform: "translate(-6%, 5%) scale(0.94)" },
        },
        "text-shimmer": { to: { backgroundPosition: "200% center" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float-up": "float-up linear infinite",
        "notification-in": "notification-in 8s ease-in-out infinite",
        "breathe": "breathe 6s ease-in-out infinite",
        "marquee": "marquee 30s linear infinite",
        "bounce-dot": "bounce-dot 1.2s ease-in-out infinite",
        "gradient-spin": "gradient-spin 4s linear infinite",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "twinkle": "twinkle 4s ease-in-out infinite",
        "star-pulse": "star-pulse 3s ease-in-out infinite",
        "shooting": "shooting 7s ease-in infinite",
        "orbit-slow": "orbit 30s linear infinite",
        "orbit-slow-rev": "orbit-rev 30s linear infinite",
        "orbit-mid": "orbit 22s linear infinite",
        "orbit-mid-rev": "orbit-rev 22s linear infinite",
        "aurora": "aurora 20s ease-in-out infinite",
        "text-shimmer": "text-shimmer 6s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
