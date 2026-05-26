/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#f1f5f9',
        canvas: '#fafafa',
        accent: '#0ea5e9',
        // Brand palette (sampled from ee_ubu_pcb_gear.svg).
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#3b59c2',
          700: '#1e40af',
          900: '#1e3a8a',
          950: '#0c1e5c',
        },
        'brand-gold': '#fde047',
        'brand-gold-soft': '#fef3c7',
      },
      boxShadow: {
        'brand': '0 1px 2px rgba(12, 30, 92, 0.08), 0 0 0 1px rgba(12, 30, 92, 0.06)',
      },
    },
  },
  plugins: [],
};
