/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#060907',
          900: '#0a0f0c',
          800: '#0e1511',
          700: '#141d17',
          600: '#1b261f',
          500: '#26332a',
        },
        lime: {
          DEFAULT: '#cdff2e',
          soft: '#e3ff82',
          dim: '#9fc41a',
        },
        fog:  '#eef3ec',
        mist: '#98a59c',
        clay: '#ff6a3d',
        sky:  '#59c2ff',
        amber: { DEFAULT: '#ffb224' },
        danger: '#ff6b6b',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans:    ['"Bricolage Grotesque Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderColor: {
        line: 'rgba(255,255,255,0.09)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { transform: 'scale(1)',   opacity: '0.6' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%':     { transform: 'translateX(-6px)' },
          '75%':     { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.16,1,0.3,1) infinite',
        shake: 'shake 0.4s ease-in-out',
      },
    }
  },
  plugins: []
}
