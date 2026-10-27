/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#0f1117',
        app: '#13161f',
        surface: '#181b26',
        elevated: '#202533',
        hover: '#2a3042',
        subtle: '#262b3c',
        accent: {
          DEFAULT: '#8b5cf6',
          light: '#a78bfa',
          muted: '#3c2d69',
        },
        warning: {
          DEFAULT: '#b45309', // oklch(0.41 0.11 46)
          foreground: '#fef3c7', // oklch(0.99 0.02 95)
        },
        success: '#10b981',
        danger: '#ef4444',
      },
      borderRadius: {
        'sm': '4.8px',
        'md': '6.4px',
        'lg': '8.0px',
        'xl': '11.2px',
        '2xl': '14.4px',
        '3xl': '17.6px',
        '4xl': '20.8px',
      }
    },
  },
  plugins: [],
}
