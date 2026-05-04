/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        liquid: '#3b82f6',
        investment: '#10b981',
        fixed: '#f59e0b',
        receivable: '#8b5cf6',
        liability: '#ef4444',
      },
    },
  },
  plugins: [],
}
