/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html'
  ],
  prefix: 'tw-',
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        rcphGold: '#F4B43A',
        rcphInk: '#121212'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
