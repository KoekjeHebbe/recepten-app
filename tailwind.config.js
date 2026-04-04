/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F2F0E9',
        terracotta: {
          50:  '#fdf1ec',
          100: '#fce3d6',
          200: '#f8c7ad',
          300: '#f2a17e',
          400: '#ea7b50',
          500: '#d96840',
          600: '#CC5833',
          700: '#a8441f',
          800: '#89371a',
          900: '#6e2c16',
        },
        olive: {
          50:  '#f1f5f2',
          100: '#dce8df',
          200: '#b8d0bc',
          300: '#8db298',
          400: '#638f72',
          500: '#476e55',
          600: '#3a5a47',
          700: '#2E4036',
          800: '#263530',
          900: '#1a2620',
        },
      },
      fontFamily: {
        sans:  ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl':  '1rem',
        '3xl':  '1.5rem',
        '4xl':  '2rem',
        '5xl':  '2.5rem',
      },
      transitionTimingFunction: {
        'magnetic': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      boxShadow: {
        'card':   '0 2px 8px 0 rgba(46,64,54,0.06), 0 1px 2px 0 rgba(46,64,54,0.04)',
        'card-hover': '0 8px 24px 0 rgba(46,64,54,0.12), 0 2px 6px 0 rgba(46,64,54,0.06)',
        'nav':    '0 4px 24px 0 rgba(46,64,54,0.10), 0 1px 4px 0 rgba(46,64,54,0.06)',
      },
    },
  },
  plugins: [],
}
