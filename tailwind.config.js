/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        noble: {
          black: '#1a1a1a',
          dark: '#2d2d2d',
          gold: '#c8a45e',
          cream: '#f5f0e8',
          white: '#fafaf8',
        },
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
