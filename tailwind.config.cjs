/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4A90E2",
          dark: "#357ABD",
          light: "#D4E3F8",
        },
        accent: {
          DEFAULT: "#13ec5b",
          dark: "#0c9e3d",
        },
        secondary: "#50E3C2",
        warning: "#F5A623",
        danger: "#FF3B30",
        success: "#34C759",
        background: {
          light: "#F2F2F7",
          dark: "#101214",
        },
        card: {
          light: "#FFFFFF",
          dark: "#1C1C1E",
        },
        text: {
          primary: {
            light: "#1C1C1E",
            dark: "#F2F2F7",
          },
          secondary: {
            light: "#8E8E93",
            dark: "#9ca3af",
          },
        },
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        sans: ["Manrope", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-in-up": "fadeInUp 0.6s ease-out",
        "loading-bar": "loadingBar 2.8s ease-in-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        loadingBar: {
          "0%": { width: "0%" },
          "20%": { width: "10%" },
          "50%": { width: "60%" },
          "100%": { width: "100%" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
