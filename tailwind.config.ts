// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0F0F0F",
          secondary: "#1A1A1A",
          elevated: "#222222",
        },
        text: {
          primary: "#F5F5F5",
          secondary: "#A1A1A1",
          muted: "#6B6B6B",
        },
        accent: {
          DEFAULT: "#C9A24A",
          soft: "#E7D8B5",
        },
        border: "#2A2A2A",

        success: "#3BA55D",
        warning: "#D4A72C",
        danger: "#D9534F",
        info: "#4A90E2",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Satoshi", "Inter", "sans-serif"],
      },

      fontSize: {
        xs: "12px",
        sm: "13px",
        md: "14px",
        base: "16px",
        lg: "18px",
        xl: "22px",
        "2xl": "28px",
        "3xl": "36px",
      },

      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },

      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
      },

      boxShadow: {
        card: "0 4px 20px rgba(0,0,0,0.3)",
      },

      backgroundImage: {
        "gradient-accent":
          "linear-gradient(135deg, #E7D8B5 0%, #C9A24A 100%)",
        "gradient-dark":
          "linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;