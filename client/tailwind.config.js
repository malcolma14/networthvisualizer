/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ig: {
          dark: '#001E60',
          mid: '#0072CE',
          light: '#8DD0EF',
          pale: '#F0F8FD',
          amber: '#ED8B00',
          red: '#D32E1A',
          green: '#00966C',
          grey: '#7A99AC',
        },
      },
      fontFamily: {
        sans: ['"Nunito Sans"', 'Calibri', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
