import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,vue}'],
  theme: {
    extend: {
      colors: {
        scope: {
          bg: '#0f0f1a',
          panel: '#1a1a2e',
          line: '#2a2a45',
          teal: '#10b981',
          gold: '#f59e0b',
        },
      },
      boxShadow: {
        glass: '0 24px 80px rgba(5, 7, 15, 0.34)',
      },
    },
  },
} satisfies Config;
