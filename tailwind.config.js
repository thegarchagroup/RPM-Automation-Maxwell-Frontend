/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maxwell: {
          50: '#f4f6f9',
          100: '#e8edf3',
          200: '#cbd6e4',
          300: '#9eb4ce',
          400: '#6b8eb3',
          500: '#476f98',
          600: '#36567c',
          700: '#2c4564',
          800: '#1e3046',
          900: '#142131',
          gold: '#c5a059',
          dark: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
