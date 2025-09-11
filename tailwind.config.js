/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d6e9ff",
          200: "#b6d7ff",
          300: "#86beff",
          400: "#519bff",
          500: "#2f7dff",
          600: "#1f64e6",
          700: "#1a51b8",
          800: "#1a458f",
          900: "#1b3a70"
        }
      }
    }
  },
  plugins: []
}

