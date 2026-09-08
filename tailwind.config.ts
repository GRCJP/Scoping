import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F8FAFC",
          50: "#FFFFFF",
          100: "#F8FAFC",
          200: "#F1F5F9",
          300: "#E5E7EB",
        },
        ink: {
          DEFAULT: "#060521",
          50: "#F8FAFC",
          100: "#E5E7EB",
          200: "#CBD5E1",
          400: "#6B7280",
          500: "#333333",
          700: "#060521",
          900: "#060521",
        },
        pine: {
          DEFAULT: "#12366C",
          50: "#EEF2F8",
          100: "#E8EEF6",
          200: "#C5D0E3",
          500: "#12366C",
          700: "#021E47",
          800: "#021E47",
        },
        brass: {
          DEFAULT: "#FBBF24",
          100: "#FEF3C7",
          400: "#FBBF24",
          600: "#D97706",
        },
        clay: {
          DEFAULT: "#E97132",
          50: "#FDEEE6",
          600: "#E97132",
        },
        navy: {
          DEFAULT: "#021E47",
          700: "#12366C",
          800: "#021638",
          900: "#01122C",
        },
        gold: {
          DEFAULT: "#FBBF24",
          400: "#FBBF24",
        },
        teal: {
          DEFAULT: "#12366C",
        },
        silver: {
          DEFAULT: "#E5E7EB",
        },
        cyan: {
          DEFAULT: "#12366C",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(6, 5, 33, 0.04)",
        lift: "0 1px 2px rgba(6, 5, 33, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
