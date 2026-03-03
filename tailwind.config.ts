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
        // Backgrounds — Core Dark
        background: {
          DEFAULT: '#0F1113',       // Core dark
          secondary: '#171A1D',     // Card backgrounds
          tertiary: '#1E2229',      // Elevated surfaces
        },

        // Brand — Trust Gold
        primary: {
          DEFAULT: '#F5B841',       // Trust Gold
          hover: '#E69C1F',         // Darker gold on hover
          light: '#FFD166',         // Light gold
        },

        accent: {
          gold: '#FFB300',          // Energy Glow gold
          amber: '#E69C1F',         // Deep amber
          teal: '#2EE6D6',          // AI Tech Accent teal
          blue: '#38B6FF',          // AI Tech Accent blue
        },

        // Semantic colors for trust levels
        trust: {
          excellent: '#2ECC71',     // 90-100 Verified green
          good: '#2ECC71',          // 70-89 (green)
          moderate: '#FFB020',      // 50-69 Warning yellow
          low: '#FF8000',           // 30-49 (orange)
          critical: '#FF4D4F',      // 0-29 Risk red
        },

        // Text colors
        text: {
          primary: '#FFFFFF',
          secondary: '#B5BDC6',
          muted: '#7A838D',
        },

        // Border colors
        border: {
          DEFAULT: 'rgba(245,184,65,0.15)',
          hover: 'rgba(245,184,65,0.3)',
        },

        // Semantic UI colors
        destructive: {
          DEFAULT: '#FF4D4F',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: 'rgba(245,184,65,0.05)',
          foreground: '#7A838D',
        },
        popover: {
          DEFAULT: '#171A1D',
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: '#171A1D',
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
          radial-gradient(at 40% 20%, rgba(245, 184, 65, 0.12) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(230, 156, 31, 0.08) 0px, transparent 50%),
          radial-gradient(at 0% 50%, rgba(255, 179, 0, 0.07) 0px, transparent 50%),
          radial-gradient(at 80% 100%, rgba(46, 230, 214, 0.06) 0px, transparent 50%)
        `,
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config