/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background))",
        foreground: "rgb(var(--foreground))",
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        serif: ['"Inter"', 'sans-serif'], // Fallback alias
        display: ['"Montserrat"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0px',
        none: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
      fontSize: {
        '7xl': '6rem',
        '8xl': '8rem',
        '9xl': '10rem',
      },
      extend: {
        borderWidth: {
          3: '3px',
        }
      }
    },
  },
  plugins: [],
}
