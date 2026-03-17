/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    '#07061a',
        surface: '#0d0b2b',
        card:    '#110e33',
        border:  '#2a2560',
        cyan:    { DEFAULT: '#00d4ff', dark: '#0099bb' },
        success: '#00ffb3',
        warning: '#ffe135',
        error:   '#ff3cac',
        muted:   '#4a4580',
        text:    { DEFAULT: '#e8e6ff', muted: '#8b86c8' },
      },
      fontFamily: {
        display: ['Rajdhani', 'Hind Siliguri', 'sans-serif'],
        mono:    ['Space Mono', 'monospace'],
        body:    ['Rajdhani', 'Hind Siliguri', 'sans-serif'],
        bangla:  ['Hind Siliguri', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
