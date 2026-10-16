/** @type {import('tailwindcss').Config} */

/**
 * Ember Studio design tokens.
 *
 * Semantic names resolve through CSS variables (see index.css) so a component
 * writes `bg-surface text-ink` once and both themes follow. The light values are
 * the published Ember Studio palette; the dark values extend it into the same
 * warm stone family, since the source system documents light only.
 */
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Surfaces — warm off-white, never pure white ── */
        page: themed('page'),
        surface: themed('surface'),
        raised: themed('raised'),
        sunken: themed('sunken'),
        overlay: themed('overlay'),

        /* ── Text ── */
        ink: {
          DEFAULT: themed('ink'),
          muted: themed('ink-muted'),
          subtle: themed('ink-subtle'),
          onAccent: themed('ink-on-accent'),
        },

        /* ── Borders ── */
        line: {
          DEFAULT: themed('line'),
          soft: themed('line-soft'),
          strong: themed('line-strong'),
        },
        hairline: { DEFAULT: themed('line'), soft: themed('line-soft') },

        /* ── Brand blue: interactive only, never decoration ──
           The ramp is anchored at 600 = #0D69D8, the blue sampled from the logo, and its
           luminance decreases monotonically from 50 to 900 so a tint never reads darker than
           the shade above it. DEFAULT and hover come from the CSS variables instead, so they
           follow the theme; these numbered steps do not and are only for the tinted chips and
           borders that need a fixed value in both themes. */
        primary: {
          50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
          400: '#60A5FA', 500: '#2F80ED', 600: '#0D69D8', 700: '#0B55B0',
          800: '#09407F', 900: '#062A52',
          DEFAULT: themed('accent'),
          hover: themed('accent-hover'),
        },
        accent: { DEFAULT: themed('amber') },

        /* ── Status ── */
        success: themed('success'),
        warning: themed('warning'),
        danger: themed('danger'),
        info: themed('info'),

        /* legacy aliases so older markup keeps compiling */
        canvas: { DEFAULT: themed('surface'), parchment: themed('page'), pearl: themed('raised') },
      },

      fontFamily: {
        /* The serif/sans contrast is this system's signature. */
        display: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Source Sans 3"', 'Source Sans Pro', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      /* Ember Studio's published steps, plus the in-between sizes a dense app
         needs. Line heights are not in the source doc — set here for rhythm. */
      fontSize: {
        overline: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        small: ['0.875rem', { lineHeight: '1.375rem' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        subhead: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        section: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.015em' }],
        headline: ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.02em' }],
        display: ['4rem', { lineHeight: '4.25rem', letterSpacing: '-0.025em' }],

        /* Tailwind's default names kept so existing markup still resolves. */
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        md: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.015em' }],
        '3xl': ['2.25rem', { lineHeight: '2.625rem', letterSpacing: '-0.02em' }],
        '4xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.02em' }],
      },

      /* Buttons 8px, cards 12px — the system asks for the mix. */
      borderRadius: {
        none: '0', xs: '4px', sm: '6px', DEFAULT: '8px', md: '8px',
        lg: '8px', xl: '12px', '2xl': '16px', full: '9999px',
      },

      /* 4px grid. */
      spacing: {
        0.5: '2px', 1: '4px', 1.5: '6px', 2: '8px', 2.5: '10px', 3: '12px',
        3.5: '14px', 4: '16px', 5: '20px', 6: '24px', 7: '28px', 8: '32px',
        10: '40px', 12: '48px', 14: '56px', 16: '64px', 20: '80px',
      },

      /* Four elevation levels, matching the system's hover / selected /
         primary-hover / modal states. Values derived: none published. */
      boxShadow: {
        xs: '0 1px 2px rgb(var(--shadow) / 0.06)',
        card: '0 1px 2px rgb(var(--shadow) / 0.05)',
        hover: '0 2px 8px rgb(var(--shadow) / 0.09), 0 1px 2px rgb(var(--shadow) / 0.05)',
        selected: '0 4px 14px rgb(var(--shadow) / 0.11)',
        'primary-hover': '0 4px 14px rgb(var(--accent) / 0.28)',
        modal: '0 24px 56px rgb(var(--shadow) / 0.20), 0 2px 8px rgb(var(--shadow) / 0.08)',
      },

      /* Tint steps used by the status chips; Tailwind's default scale skips these. */
      opacity: { 6: '0.06', 7: '0.07', 12: '0.12', 14: '0.14', 16: '0.16' },

      maxWidth: { content: '76rem', prose: '44rem' },

      transitionTimingFunction: { snap: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      transitionDuration: { 250: '250ms' },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.99)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in 140ms ease-out both',
        'scale-in': 'scale-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'slide-in': 'slide-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
