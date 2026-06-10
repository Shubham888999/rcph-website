/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './js/public-ui.js'
  ],
  safelist: [
    'tw-rcph-section',
    'tw-rcph-container',
    'tw-rcph-eyebrow',
    'tw-rcph-heading',
    'tw-rcph-subtitle',
    'tw-rcph-card',
    'tw-rcph-button',
    'tw-rcph-button-outline',
    'tw-rcph-pill',
    'tw-rcph-grid',
    'tw-rcph-glass',
    'tw-rcph-divider',
    'tw-reveal',
    'tw-reveal-up',
    'tw-reveal-left',
    'tw-reveal-right',
    'tw-is-visible',
    'tw-is-scrolled'
  ],
  prefix: 'tw-',
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        rcph: {
          bg: '#090909',
          surface: '#121212',
          surfaceSoft: '#1A1712',
          gold: '#F4B43A',
          goldSoft: '#FFD76B',
          goldDeep: '#B98213',
          white: '#F8F4E6',
          muted: '#BDB5A2',
          line: 'rgba(244, 180, 58, 0.24)',
          glass: 'rgba(18, 18, 18, 0.68)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        rcphSm: '4px',
        rcph: '6px',
        rcphLg: '8px',
        rcphPill: '999px'
      },
      boxShadow: {
        rcphCard: '0 18px 42px rgba(0, 0, 0, 0.34)',
        rcphGold: '0 12px 30px rgba(244, 180, 58, 0.18)',
        rcphInset: 'inset 0 0 0 1px rgba(244, 180, 58, 0.18)'
      },
      keyframes: {
        rcphFadeUp: {
          '0%': { opacity: '0', transform: 'translate3d(0, 18px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' }
        },
        rcphSoftPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.72' }
        }
      },
      animation: {
        rcphFadeUp: 'rcphFadeUp 520ms ease-out both',
        rcphSoftPulse: 'rcphSoftPulse 2.8s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
