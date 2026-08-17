import defaultTheme from 'tailwindcss/defaultTheme'

// Reads a "R G B" CSS variable (see globals.css) so Tailwind's opacity
// modifiers keep working, e.g. bg-primary/40 -> rgb(var(--color-primary) / 0.4).
// Not typed against tailwindcss's `Config` below — its color type doesn't
// model this (officially supported) function-value pattern.
function withOpacity(variable: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${opacityValue})`
}

const config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: withOpacity('--color-bg'),
        surface: { DEFAULT: withOpacity('--color-surface'), 2: withOpacity('--color-surface-2') },
        border: { DEFAULT: withOpacity('--color-border'), strong: withOpacity('--color-border-strong') },
        ink: { DEFAULT: withOpacity('--color-text'), muted: withOpacity('--color-text-muted'), subtle: withOpacity('--color-text-subtle') },
        primary: {
          DEFAULT: withOpacity('--color-primary'),
          hover: withOpacity('--color-primary-hover'),
          active: withOpacity('--color-primary-active'),
          subtle: withOpacity('--color-primary-subtle'),
          on: withOpacity('--color-on-primary'),
        },
        danger: { DEFAULT: withOpacity('--color-danger'), subtle: withOpacity('--color-danger-subtle'), on: withOpacity('--color-danger-on') },
        warning: { DEFAULT: withOpacity('--color-warning'), subtle: withOpacity('--color-warning-subtle'), on: withOpacity('--color-warning-on') },
        info: { DEFAULT: withOpacity('--color-info'), subtle: withOpacity('--color-info-subtle') },
        clay: { DEFAULT: withOpacity('--color-clay'), subtle: withOpacity('--color-clay-subtle') },
        accent: { DEFAULT: withOpacity('--color-accent'), subtle: withOpacity('--color-accent-subtle'), on: withOpacity('--color-accent-on') },
        business: { DEFAULT: withOpacity('--color-business'), subtle: withOpacity('--color-business-subtle') },
      },
      fontFamily: {
        // Numbers only (price, date, phone, counts) — see design_system.md.
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        control: '10px',
        panel: '16px',
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        elevated: 'var(--shadow-elevated)',
        overlay: 'var(--shadow-overlay)',
      },
    },
  },
  plugins: [],
}
export default config
