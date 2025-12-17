/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1e1e1e', // Matches Python app MODERN_STYLE
        surface: '#2b2b2b',    // CANVAS_BG_COLOR
        control: '#333333',    // Right panel
        border: '#444444',
        primary: '#0078d4',
        'primary-hover': '#1086e0',
        danger: '#c42b1c',
        'danger-hover': '#d83b2a',
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"PingFang SC"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
