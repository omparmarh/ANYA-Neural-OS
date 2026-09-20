/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#030508',
          900: '#05070c',
          850: '#070a12',
          800: '#0b101d',
          700: '#111827',
        },
        cyber: {
          cyan: '#00f0ff',
          blue: '#3b82f6',
          emerald: '#10b981',
          amber: '#f59e0b',
          crimson: '#ef4444',
          glow: 'rgba(0, 240, 255, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'cyan-glow': '0 0 25px -5px rgba(0, 240, 255, 0.3)',
        'blue-glow': '0 0 25px -5px rgba(59, 130, 246, 0.3)',
        'emerald-glow': '0 0 25px -5px rgba(16, 185, 129, 0.3)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
