/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        venom: {
          50: '#f1ffd9',
          100: '#e1ffaf',
          200: '#caff77',
          300: '#b8ff3a',
          400: '#a3ff15',
          500: '#88e300',
          600: '#6cb000',
          700: '#558700',
          800: '#446a06',
          900: '#395909',
          950: '#1c3100',
        },
        obsidian: {
          950: '#030305',
          900: '#06070a',
          800: '#0a0c11',
          700: '#11141b',
          600: '#181c25',
          500: '#222631',
        },
        symbiote: {
          tongue: '#ff2d6d',
          ichor: '#7c3aed',
        },
      },
      boxShadow: {
        'venom': '0 0 0 1px rgba(184,255,58,0.25), 0 8px 28px -8px rgba(184,255,58,0.35)',
        'venom-glow': '0 0 24px rgba(184,255,58,0.45), 0 0 60px rgba(184,255,58,0.18)',
        'venom-soft': '0 0 18px rgba(184,255,58,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pop': 'pop 0.2s ease-out',
        'pulse-venom': 'pulseVenom 2.4s ease-in-out infinite',
        'drip': 'drip 1.2s ease-in-out',
        'fall': 'fall var(--fall-dur,3s) cubic-bezier(.4,.0,.5,1) forwards',
        'celebrate': 'celebrate 2.6s ease-out forwards',
        'burst': 'burst 1s ease-out forwards',
        'sparkle': 'sparkle 2.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseVenom: {
          '0%, 100%': {
            filter: 'drop-shadow(0 0 4px rgba(184,255,58,0.4))',
          },
          '50%': {
            filter: 'drop-shadow(0 0 14px rgba(184,255,58,0.85))',
          },
        },
        drip: {
          '0%': { transform: 'scaleY(0)', transformOrigin: 'top', opacity: 0.5 },
          '100%': { transform: 'scaleY(1)', transformOrigin: 'top', opacity: 1 },
        },
        fall: {
          '0%': {
            transform: 'translate3d(0,-10vh,0) rotate(0deg)',
            opacity: 0,
          },
          '8%': { opacity: 1 },
          '50%': {
            transform: 'translate3d(var(--drift,0px),50vh,0) rotate(360deg)',
          },
          '92%': { opacity: 1 },
          '100%': {
            transform: 'translate3d(calc(var(--drift,0px) * -1),110vh,0) rotate(720deg)',
            opacity: 0,
          },
        },
        celebrate: {
          '0%': { opacity: 0, transform: 'scale(0.4)' },
          '15%': { opacity: 1, transform: 'scale(1.12)' },
          '24%': { transform: 'scale(0.97)' },
          '32%': { transform: 'scale(1.02)' },
          '40%': { transform: 'scale(1)' },
          '78%': { opacity: 1, transform: 'scale(1)' },
          '100%': { opacity: 0, transform: 'scale(1.08)' },
        },
        burst: {
          '0%': { opacity: 0.7, transform: 'scale(0)' },
          '60%': { opacity: 0.4 },
          '100%': { opacity: 0, transform: 'scale(9)' },
        },
        sparkle: {
          '0%, 100%': { opacity: 0, transform: 'scale(0.6) rotate(0deg)' },
          '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' },
        },
      },
    },
  },
  plugins: [],
}
