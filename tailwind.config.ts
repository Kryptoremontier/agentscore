import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Backgrounds
        background: {
          DEFAULT: '#0A0A0F',      // Deep space black
          secondary: '#0D1117',     // Card backgrounds
          tertiary: '#161B22',      // Elevated surfaces
        },

        // Brand colors (Intuition-inspired)
        primary: {
          DEFAULT: '#0066FF',       // Electric blue
          hover: '#0052CC',
          light: '#3385FF',
        },

        accent: {
          cyan: '#00D4FF',          // Highlights
          purple: '#8B5CF6',        // Secondary accent
        },

        // Semantic colors for trust levels
        trust: {
          excellent: '#06B6D4',     // 90-100 (cyan)
          good: '#22C55E',          // 70-89 (green)
          moderate: '#EAB308',      // 50-69 (yellow)
          low: '#F97316',           // 30-49 (orange)
          critical: '#EF4444',      // 0-29 (red)
        },

        // Text colors
        text: {
          primary: '#FFFFFF',
          secondary: '#94A3B8',
          muted: '#64748B',
        },

        // Border colors
        border: {
          DEFAULT: 'rgba(255,255,255,0.1)',
          hover: 'rgba(255,255,255,0.2)',
        },

        // Semantic UI colors
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          foreground: '#94A3B8',
        },
        popover: {
          DEFAULT: '#0D1117',
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: '#0D1117',
          foreground: '#FFFFFF',
        },
      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },

      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'gradient': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },

      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': `
          radial-gradient(at 40% 20%, rgba(0, 102, 255, 0.15) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.1) 0px, transparent 50%),
          radial-gradient(at 0% 50%, rgba(0, 212, 255, 0.1) 0px, transparent 50%),
          radial-gradient(at 80% 100%, rgba(0, 102, 255, 0.1) 0px, transparent 50%)
        `,
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config