/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d3d8e0',
          300: '#aab2bf',
          400: '#7b8493',
          500: '#525c6e',
          600: '#3a4252',
          700: '#2a3142',
          800: '#1c2233',
          900: '#0f1421',
          950: '#080b15',
        },
        signal: {
          ok: '#16a34a',
          warn: '#eab308',
          err: '#dc2626',
          info: '#2563eb',
          ai: '#7c3aed',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
