export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'fp-bg': '#F6F8FB',
        'fp-surface': '#FFFFFF',
        'fp-navy': '#0B1524',
        'fp-navy-2': '#101E33',
        'fp-navy-3': '#1A2B45',
        'fp-accent': '#2A78D6',
        'fp-accent-dark': '#1E5EB0',
        'fp-accent-soft': '#E8F1FB',
        'fp-ink': '#0F1B2D',
        'fp-ink-2': '#47586E',
        'fp-ink-3': '#8B99AD',
        'fp-line': '#E6EAF1',
        'fp-good': '#1B7F3B',
        'fp-good-soft': '#E8F4EC',
        'fp-bad': '#C0392B',
        'fp-bad-soft': '#FBEDED',
        'fp-warn': '#9A6B00',
        'fp-warn-soft': '#FAF3E3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 27, 45, 0.04), 0 8px 24px rgba(15, 27, 45, 0.05)',
        pop: '0 12px 32px rgba(15, 27, 45, 0.14)',
      },
    },
  },
  plugins: [],
};
