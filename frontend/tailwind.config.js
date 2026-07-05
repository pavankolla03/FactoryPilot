export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'fp-bg-main': '#F5F6F8',
        'fp-bg-sidebar': '#14151A',
        'fp-accent-orange': '#F5A623',
        'fp-accent-orange-dark': '#8A5A1B',
        'fp-badge-peach': '#FCEBD5',
        'fp-badge-green-bg': '#E4F5E4',
        'fp-badge-green-text': '#2F7A3D',
        'fp-text-primary': '#1A1D21',
        'fp-text-muted': '#8A8F98',
        'fp-border-light': '#E5E7EB'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
};
