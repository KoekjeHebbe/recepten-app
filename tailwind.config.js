/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fdf6ec',
        terracotta: {
          50: '#fdf2ee',
          100: '#fbe4d8',
          200: '#f6c8b1',
          300: '#f0a580',
          400: '#e87a4d',
          500: '#e05a2b',
          600: '#d24120',
          700: '#ae311c',
          800: '#8b291d',
          900: '#71251a',
        },
        olive: {
          50: '#f5f6ee',
          100: '#e9ecda',
          200: '#d4d9b8',
          300: '#b9c08e',
          400: '#9da66a',
          500: '#828d4f',
          600: '#65703c',
          700: '#4f5731',
          800: '#40462a',
          900: '#363b25',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
