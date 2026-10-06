/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './scene/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        monad: {
          50: '#f5f3ff',
          500: '#836EF9',
          600: '#7053f7',
          700: '#5c35f5',
          900: '#20085a',
        },
      },
    },
  },
  plugins: [],
};
