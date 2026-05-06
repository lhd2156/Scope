import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,vue}'],
  theme: {
    extend: {
      colors: {
        scope: {
          bg: '#020617',
          panel: '#0f172a',
          line: '#1e293b',
          blue: '#38bdf8',
          teal: '#2dd4bf',
        },
      },
      boxShadow: {
        glass: '0 24px 80px rgba(2, 6, 23, 0.35)',
      },
    },
  },
} satisfies Config;
