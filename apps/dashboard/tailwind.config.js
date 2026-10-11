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
          100: '#e9e4ff',
          200: '#d6cdff',
          300: '#bcb0fe',
          400: '#9f8ffa',
          500: '#836EF9',
          600: '#7053f7',
          700: '#5c35f5',
          800: '#301e98',
          900: '#20085a',
          950: '#100434',
        },
      },
    },
  },
  plugins: [],
};
